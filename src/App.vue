<script setup lang="ts">
import { PhArrowClockwise, PhSpeakerHigh, PhSpeakerSlash } from '@phosphor-icons/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import saintImage from './assets/saint-tibo.jpg'
import saintImage640 from './assets/saint-tibo-640.jpg'
import BrandMark from './components/BrandMark.vue'
import Odometer from './components/Odometer.vue'
import {
  ClickSound,
  ParticleField,
  shakeElement,
  spawnPlusOne,
} from './effects'
import {
  countryFlag,
  countryName,
  detectLocale,
  formatLocation,
  formatNumber,
  messages,
  storeLocale,
  type Locale,
} from './i18n'
import { usePetition, type PetitionStatus } from './usePetition'

const locale = ref<Locale>(detectLocale())
const m = computed(() => messages[locale.value])
const {
  stats,
  total,
  today,
  last5m,
  countries,
  topCountries,
  topRegions,
  yourCountry,
  yourRegion,
  myClicks,
  bestCombo,
  combo,
  comboKey,
  tierIndex,
  status,
  registerClick,
} = usePetition()

const stageRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const floatLayerRef = ref<HTMLElement | null>(null)
const pressKey = ref(0)
const soundEnabled = ref(readSoundPreference())
const sound = new ClickSound()
sound.enabled = soundEnabled.value
let particles: ParticleField | null = null

const loading = computed(() => !stats.value && total.value === 0)
const heat = computed(() => Math.min(1, combo.value / 40))
const shellStyle = computed(() => ({ '--heat': heat.value.toFixed(3) }))
const isLocalPreview = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
const yourLocation = computed(() => {
  if (!yourCountry.value && isLocalPreview) return m.value.localPreview
  return formatLocation(yourCountry.value, yourRegion.value, locale.value)
})
const visibleCountries = computed(() =>
  topCountries.value.filter((entry) => entry.country !== 'XX').slice(0, 5),
)
const topRegionLabel = computed(() => {
  const top = topRegions.value[0]
  if (!top) return m.value.topRegionNone
  const name = countryName(top.country, locale.value)
  return `${top.region}, ${name}`
})
const statusLabel = computed(() => {
  const labels: Record<PetitionStatus, string> = {
    connecting: m.value.connecting,
    live: m.value.live,
    retrying: m.value.retrying,
    syncing: m.value.syncing,
    offline: m.value.offline,
    error: m.value.error,
  }
  return labels[status.value]
})
const saintSrcSet = `${saintImage640} 640w, ${saintImage} 1021w`

watch(
  locale,
  (value) => {
    document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
    document.title = messages[value].metaTitle
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', messages[value].metaDescription)
    storeLocale(value)
  },
  { immediate: true },
)

onMounted(() => {
  if (canvasRef.value) particles = new ParticleField(canvasRef.value)
})

onBeforeUnmount(() => {
  particles?.destroy()
  particles = null
})

function toggleLocale(): void {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
}

function toggleSound(): void {
  soundEnabled.value = !soundEnabled.value
  sound.enabled = soundEnabled.value
  persistSoundPreference(soundEnabled.value)
  if (soundEnabled.value) sound.play(1)
}

function handlePress(event: MouseEvent): void {
  const level = registerClick()
  pressKey.value += 1
  sound.play(level)

  const rect = buttonRef.value?.getBoundingClientRect()
  const keyboard = event.detail === 0
  const x = keyboard || !rect ? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) : event.clientX
  const y = keyboard || !rect ? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) : event.clientY

  particles?.burst(x, y, level)
  if (floatLayerRef.value) spawnPlusOne(floatLayerRef.value, x, y)
  if (level >= 5 && stageRef.value) {
    shakeElement(stageRef.value, Math.min(4, 1 + level / 25))
  }
}

function readSoundPreference(): boolean {
  try {
    return localStorage.getItem('dim-reset.sound') === 'on'
  } catch {
    return false
  }
}

function persistSoundPreference(enabled: boolean): void {
  try {
    localStorage.setItem('dim-reset.sound', enabled ? 'on' : 'off')
  } catch {
    // Storage can be unavailable in private modes.
  }
}
</script>

<template>
  <div class="shell" :style="shellStyle">
    <div class="ambient" aria-hidden="true" />
    <div class="grain" aria-hidden="true" />

    <header class="topbar">
      <a class="brand-lockup" href="https://dimagent.com" target="_blank" rel="noreferrer">
        <BrandMark :size="21" label="DimAgent" :label-size="18" />
        <span class="brand-rule" aria-hidden="true" />
        <span class="brand-sub">{{ m.brandSub }}</span>
      </a>

      <div class="controls">
        <button
          class="control-button icon-button"
          type="button"
          :aria-label="soundEnabled ? m.soundOn : m.soundOff"
          :title="soundEnabled ? m.soundOn : m.soundOff"
          :aria-pressed="soundEnabled"
          @click="toggleSound"
        >
          <PhSpeakerHigh v-if="soundEnabled" :size="17" weight="bold" aria-hidden="true" />
          <PhSpeakerSlash v-else :size="17" weight="bold" aria-hidden="true" />
        </button>
        <button
          class="control-button language-button"
          type="button"
          :aria-label="m.languageLabel"
          @click="toggleLocale"
        >
          {{ m.languageLabel }}
        </button>
        <span class="status-pill" :data-state="status" role="status" aria-live="polite">
          <span class="status-dot" aria-hidden="true" />
          {{ statusLabel }}
        </span>
      </div>
    </header>

    <main ref="stageRef" class="stage">
      <section class="art-column">
        <figure class="saint-frame">
          <img
            :src="saintImage"
            :srcset="saintSrcSet"
            sizes="(max-width: 900px) 78vw, (max-width: 1359px) 38vw, 30vw"
            width="1021"
            height="1541"
            :alt="m.imageAlt"
            fetchpriority="high"
            decoding="async"
          />
          <div class="saint-seal">
            <span class="seal-tile">
              <BrandMark :size="18" label="" tone="ink" />
            </span>
            <span class="seal-word">DIMAGENT</span>
          </div>
          <figcaption class="saint-caption">
            <span class="caption-title">{{ m.captionTitle }}</span>
            <span class="caption-native">夕阳针</span>
            <span class="caption-sub">{{ m.captionSub }}</span>
          </figcaption>
        </figure>
      </section>

      <section class="message-column">
        <p class="brandline">{{ m.headlineBrand }}</p>
        <h1 class="headline">
          {{ m.headlineBefore }}<span class="accent">{{ m.headlineAccent }}</span>{{ m.headlineAfter }}
        </h1>
        <p class="subline">{{ m.subline }}</p>

        <div class="cta-block">
          <button
            ref="buttonRef"
            class="reset-button"
            type="button"
            :aria-label="m.buttonAria"
            @click="handlePress"
          >
            <span class="button-label">{{ m.button }}</span>
            <span class="button-meta">
              <span :key="pressKey" class="button-icon">
                <PhArrowClockwise :size="24" weight="bold" aria-hidden="true" />
              </span>
              <span class="button-count">×{{ formatNumber(myClicks, locale) }}</span>
            </span>
          </button>

          <div class="streak-row">
            <div class="streak">
              <span class="meta-label">{{ m.streak }}</span>
              <strong class="meta-value">×{{ combo }}</strong>
              <span v-if="combo > 0" class="tier">{{ m.tiers[tierIndex] }}</span>
              <span v-if="combo > 0" class="streak-track" aria-hidden="true">
                <span :key="comboKey" class="streak-fill" />
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ m.best }}</span>
              <strong class="meta-value">×{{ bestCombo }}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ m.yourClicks }}</span>
              <strong class="meta-value">{{ formatNumber(myClicks, locale) }}</strong>
            </div>
          </div>
        </div>
      </section>

      <aside class="ledger" :aria-label="m.totalLabel">
        <div class="ledger-total">
          <div class="ledger-head">
            <span class="section-label">{{ m.totalLabel }}</span>
          </div>
          <Odometer
            :value="total"
            :locale="locale"
            :loading="loading"
            :loading-label="m.totalLabel"
          />
          <dl class="metrics">
            <div class="metric">
              <dt>{{ m.today }}</dt>
              <dd>{{ formatNumber(today, locale) }}</dd>
            </div>
            <div class="metric">
              <dt>{{ m.last5m }}</dt>
              <dd>{{ formatNumber(last5m, locale) }}</dd>
            </div>
            <div class="metric">
              <dt>{{ m.countries }}</dt>
              <dd>{{ formatNumber(countries, locale) }}</dd>
            </div>
          </dl>
        </div>

        <div class="ledger-signals">
          <div class="signals">
            <span class="section-label">{{ m.topSignals }}</span>
            <ul v-if="visibleCountries.length > 0" class="country-list">
              <li v-for="entry in visibleCountries" :key="entry.country" class="country-row">
                <span class="country-flag" aria-hidden="true">{{ countryFlag(entry.country) }}</span>
                <span class="country-name">{{ countryName(entry.country, locale) }}</span>
                <span class="country-count">{{ formatNumber(entry.clicks, locale) }}</span>
              </li>
            </ul>
            <p v-else class="empty-signals">{{ m.noSignals }}</p>
          </div>

          <div class="top-region">
            <span class="section-label">{{ m.topRegion }}</span>
            <strong class="region-value">{{ topRegionLabel }}</strong>
          </div>
        </div>
      </aside>
    </main>

    <footer class="footer">
      <div class="footer-signal">
        <span class="section-label">{{ m.yourSignal }}</span>
        <strong>{{ yourLocation }}</strong>
      </div>
      <p class="footer-copy">{{ m.footer }}</p>
      <p class="footer-privacy">{{ m.privacy }}</p>
    </footer>

    <canvas ref="canvasRef" class="particles" aria-hidden="true" />
    <div ref="floatLayerRef" class="float-layer" aria-hidden="true" />
  </div>
</template>
