<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
    label?: string
    labelSize?: number
    tone?: 'ink' | 'white'
  }>(),
  { size: 24, label: 'DimAgent', labelSize: 18, tone: 'white' },
)
</script>

<template>
  <span class="brand-mark" :class="tone === 'white' ? 'is-white' : 'is-ink'">
    <svg
      :width="Math.round((size * 45) / 32)"
      :height="size"
      viewBox="0 0 45 32"
      fill="none"
      aria-hidden="true"
      class="brand-glyph"
    >
      <path
        d="M30.5753 0.061063C24.084 -0.350713 17.6572 1.3463 12.0353 4.35976C5.50548 7.916 -1.94527 14.9536 0.463184 22.9957C2.3951 28.848 9.11815 30.9755 14.8817 30.9755C17.8697 31.0254 18.1981 26.8827 15.223 26.5021C14.3923 26.4085 13.2267 26.3523 12.4088 26.1839C6.3362 25.1045 3.08415 21.1802 6.96729 15.6524C11.0179 10.1808 18.1273 7.04878 24.889 6.15036C32.3526 5.07724 42.463 8.11566 35.7206 16.6569C34.1557 18.5723 32.1079 20.1944 29.8926 21.5046C29.2487 21.8852 28.4244 21.4422 28.4244 20.7123V16.8378C28.4244 15.2718 27.1171 14.0053 25.5008 14.0053C23.8844 14.0053 22.5771 15.2718 22.5771 16.8378V29.1599C22.5771 30.7259 23.8844 31.9924 25.5008 31.9924C26.8145 31.9924 27.9221 31.1564 28.2892 30.0022C28.4308 29.5654 28.7335 29.1973 29.1714 29.0164C29.6544 28.8168 30.1309 28.6046 30.6075 28.3863C36.5835 25.4976 42.4114 20.9868 44.1502 14.3297C46.1336 5.66371 38.6249 0.52899 30.5753 0.061063Z"
        fill="currentColor"
      />
    </svg>
    <span
      v-if="label"
      class="brand-word"
      :style="{ fontSize: `${labelSize}px` }"
    >
      {{ label }}
    </span>
  </span>
</template>

<style scoped>
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
}

.brand-mark.is-ink {
  color: var(--bg);
}

.brand-glyph {
  flex: none;
}

.brand-word {
  font-family: var(--font-ui);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
}
</style>
