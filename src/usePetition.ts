import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError, fetchStats, postClicks } from './api'
import { MAX_CLICKS_PER_REQUEST, type StatsSnapshot } from '../shared/contract'

const PENDING_KEY = 'dim-reset.pending'
const MY_CLICKS_KEY = 'dim-reset.my-clicks'
const BEST_COMBO_KEY = 'dim-reset.best-combo'
const POLL_MS = 10_000
const RETRY_MS = 4_000
const FLUSH_DELAY_MS = 450
const COMBO_TIMEOUT_MS = 1_600

export type PetitionStatus = 'connecting' | 'live' | 'retrying' | 'syncing' | 'offline' | 'error'

export function usePetition() {
  const stats = ref<StatsSnapshot | null>(null)
  const pending = ref(readStoredInt(PENDING_KEY))
  const inflight = ref(0)
  const myClicks = ref(readStoredInt(MY_CLICKS_KEY))
  const bestCombo = ref(readStoredInt(BEST_COMBO_KEY))
  const combo = ref(0)
  const comboKey = ref(0)
  const connectionState = ref<'idle' | 'ok' | 'retrying'>('idle')
  const online = ref(navigator.onLine)
  const syncError = ref(false)
  const localDelta = computed(() => pending.value + inflight.value)
  const total = computed(() => (stats.value?.total ?? 0) + localDelta.value)
  const today = computed(() => (stats.value?.today ?? 0) + localDelta.value)
  const last5m = computed(() => (stats.value?.last5m ?? 0) + localDelta.value)
  const tierIndex = computed(() => {
    if (combo.value >= 60) return 3
    if (combo.value >= 30) return 2
    if (combo.value >= 10) return 1
    return 0
  })
  const status = computed<PetitionStatus>(() => {
    if (syncError.value) return 'error'
    if (!online.value) return 'offline'
    if (!stats.value) {
      return connectionState.value === 'retrying' ? 'retrying' : 'connecting'
    }
    if (localDelta.value > 0) return 'syncing'
    return connectionState.value === 'retrying' ? 'retrying' : 'live'
  })

  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let comboTimer: ReturnType<typeof setTimeout> | undefined
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let syncErrorTimer: ReturnType<typeof setTimeout> | undefined
  let flushing = false
  let refreshing = false
  let disposed = false

  function registerClick(): number {
    pending.value += 1
    persistInt(PENDING_KEY, pending.value)
    myClicks.value += 1
    persistInt(MY_CLICKS_KEY, myClicks.value)
    combo.value += 1
    comboKey.value += 1
    if (combo.value > bestCombo.value) {
      bestCombo.value = combo.value
      persistInt(BEST_COMBO_KEY, bestCombo.value)
    }
    clearTimeout(comboTimer)
    comboTimer = setTimeout(() => {
      combo.value = 0
    }, COMBO_TIMEOUT_MS)
    scheduleFlush(FLUSH_DELAY_MS)
    return combo.value
  }

  function scheduleFlush(delay: number): void {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      void flush()
    }, delay)
  }

  async function flush(): Promise<void> {
    if (disposed || flushing || pending.value === 0) return
    if (!navigator.onLine) {
      online.value = false
      return
    }

    flushing = true
    const count = Math.min(pending.value, MAX_CLICKS_PER_REQUEST)
    pending.value -= count
    inflight.value += count
    persistInt(PENDING_KEY, pending.value)

    try {
      const result = await postClicks(count)
      inflight.value = Math.max(0, inflight.value - count)
      const accepted = Math.min(count, result.accepted)
      if (accepted < count) {
        pending.value += count - accepted
        persistInt(PENDING_KEY, pending.value)
      }
      applyStats(result)
      connectionState.value = 'ok'
      online.value = true
    } catch (error) {
      inflight.value = Math.max(0, inflight.value - count)
      const permanent =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429

      if (permanent) {
        showSyncError()
        console.error('reset petition rejected a local batch', error)
      } else {
        pending.value += count
        persistInt(PENDING_KEY, pending.value)
        connectionState.value = 'retrying'
        scheduleRetry()
      }
    } finally {
      flushing = false
      if (pending.value > 0 && !disposed) {
        scheduleFlush(pending.value >= MAX_CLICKS_PER_REQUEST ? 100 : 600)
      }
    }
  }

  async function refreshStats(): Promise<void> {
    if (disposed || refreshing) return
    refreshing = true
    try {
      applyStats(await fetchStats())
      connectionState.value = 'ok'
      online.value = true
    } catch {
      if (connectionState.value !== 'ok') connectionState.value = 'retrying'
    } finally {
      refreshing = false
    }
  }

  function applyStats(next: StatsSnapshot): void {
    if (!stats.value || next.updatedAt >= stats.value.updatedAt) {
      stats.value = next
    }
  }

  function scheduleRetry(): void {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      void flush()
    }, RETRY_MS)
  }

  function showSyncError(): void {
    syncError.value = true
    clearTimeout(syncErrorTimer)
    syncErrorTimer = setTimeout(() => {
      syncError.value = false
    }, 8_000)
  }

  function schedulePoll(delay = POLL_MS): void {
    clearTimeout(pollTimer)
    pollTimer = setTimeout(async () => {
      if (!disposed && document.visibilityState === 'visible') {
        await refreshStats()
        if (pending.value > 0) void flush()
      }
      if (!disposed) schedulePoll()
    }, delay)
  }

  function onOnline(): void {
    online.value = true
    connectionState.value = 'idle'
    void refreshStats()
    if (pending.value > 0) scheduleFlush(0)
  }

  function onOffline(): void {
    online.value = false
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void refreshStats()
      if (pending.value > 0) scheduleFlush(0)
    } else {
      void flush()
    }
  }

  function flushOnPageHide(): void {
    if (pending.value === 0 || !navigator.sendBeacon) {
      if (pending.value > 0) void flush()
      return
    }

    for (let attempt = 0; attempt < 3 && pending.value > 0; attempt += 1) {
      const count = Math.min(pending.value, MAX_CLICKS_PER_REQUEST)
      const payload = new Blob([JSON.stringify({ count })], { type: 'application/json' })
      if (!navigator.sendBeacon('/api/click', payload)) break
      pending.value -= count
      persistInt(PENDING_KEY, pending.value)
    }
  }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('pagehide', flushOnPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    void refreshStats()
    if (pending.value > 0) scheduleFlush(0)
    schedulePoll()
  })

  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('pagehide', flushOnPageHide)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    clearTimeout(flushTimer)
    clearTimeout(retryTimer)
    clearTimeout(comboTimer)
    clearTimeout(pollTimer)
    clearTimeout(syncErrorTimer)
  })

  return {
    stats,
    total,
    today,
    last5m,
    countries: computed(() => stats.value?.countries ?? 0),
    topCountries: computed(() => stats.value?.topCountries ?? []),
    topRegions: computed(() => stats.value?.topRegions ?? []),
    yourCountry: computed(() => stats.value?.yourCountry ?? null),
    yourRegion: computed(() => stats.value?.yourRegion ?? null),
    myClicks,
    bestCombo,
    combo,
    comboKey,
    tierIndex,
    status,
    pending,
    registerClick,
    refreshStats,
    flush,
  }
}

function readStoredInt(key: string): number {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

function persistInt(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Storage can be unavailable in private modes.
  }
}
