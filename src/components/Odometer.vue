<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber, type Locale } from '../i18n'

const props = defineProps<{
  value: number
  locale: Locale
  loading: boolean
  loadingLabel?: string
}>()

const formatted = computed(() => formatNumber(props.value, props.locale))
const characters = computed(() => [...formatted.value])
</script>

<template>
  <div
    class="odometer"
    :class="{ 'is-loading': loading }"
    :aria-busy="loading"
    :aria-label="loading ? (loadingLabel ?? 'Loading total') : formatted"
    role="img"
  >
    <template v-if="loading">
      <span v-for="index in 7" :key="`skeleton-${index}`" class="digit skeleton" aria-hidden="true" />
    </template>
    <template v-else>
      <template v-for="(character, index) in characters" :key="`${index}-${character}`">
        <span v-if="/\d/.test(character)" class="digit" aria-hidden="true">{{ character }}</span>
        <span v-else class="separator" aria-hidden="true">{{ character }}</span>
      </template>
    </template>
  </div>
</template>

<style scoped>
.odometer {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
  gap: clamp(2px, 0.35vw, 6px);
  min-height: clamp(52px, 4.4vw, 68px);
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 4.2vw, 4.2rem);
  font-size: clamp(2.4rem, 15cqw, 4.2rem);
  font-weight: 600;
  font-variant-numeric: lining-nums tabular-nums;
  line-height: 0.82;
  letter-spacing: -0.045em;
  color: var(--parchment);
}

.digit {
  display: inline-block;
  min-width: 0.52em;
  animation: digit-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.separator {
  display: inline-block;
  color: var(--gold-dim);
  font-size: 0.58em;
  transform: translateY(-0.06em);
}

.skeleton {
  width: 0.45em;
  height: 0.72em;
  margin-top: 0.08em;
  background: linear-gradient(90deg, var(--line) 20%, var(--line-strong) 50%, var(--line) 80%);
  background-size: 200% 100%;
  animation: skeleton 1.4s linear infinite;
}

@keyframes digit-in {
  from {
    opacity: 0;
    transform: translateY(0.28em);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes skeleton {
  from {
    background-position: 150% 0;
  }
  to {
    background-position: -50% 0;
  }
}

@media (max-width: 560px) {
  .odometer {
    font-size: clamp(2.9rem, 14vw, 4.2rem);
    min-height: 56px;
  }
}
</style>
