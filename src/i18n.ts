export type Locale = 'en' | 'zh'

export interface Messages {
  metaTitle: string
  metaDescription: string
  brandSub: string
  live: string
  connecting: string
  retrying: string
  offline: string
  syncing: string
  error: string
  headlineBrand: string
  headlineBefore: string
  headlineAccent: string
  headlineAfter: string
  subline: string
  button: string
  buttonAria: string
  totalLabel: string
  today: string
  last5m: string
  countries: string
  streak: string
  best: string
  yourClicks: string
  topSignals: string
  noSignals: string
  yourSignal: string
  localPreview: string
  captionTitle: string
  captionSub: string
  footer: string
  privacy: string
  soundOn: string
  soundOff: string
  languageLabel: string
  topRegion: string
  topRegionNone: string
  tiers: readonly [string, string, string, string]
  imageAlt: string
}

export const messages: Record<Locale, Messages> = {
  en: {
    metaTitle: 'DimAgent, reset us. | Saint Tibo hears you',
    metaDescription:
      'A community petition for a DimAgent reset. Every click is counted by region. Saint Tibo grants the tokens.',
    brandSub: 'RESET PETITION',
    live: 'LIVE',
    connecting: 'CONNECTING',
    retrying: 'RETRYING',
    offline: 'OFFLINE',
    syncing: 'SYNCING',
    error: 'SYNC ERROR',
    headlineBrand: 'DIMAGENT,',
    headlineBefore: 'RESET US',
    headlineAccent: '.',
    headlineAfter: '',
    subline:
      'Saint Tibo grants the tokens. We just count the requests. Every click is stored by region.',
    button: 'PRAY FOR A RESET',
    buttonAria: 'Pray for a reset and count one request',
    totalLabel: 'RESET REQUESTS',
    today: 'TODAY',
    last5m: 'LAST 5 MIN',
    countries: 'COUNTRIES',
    streak: 'STREAK',
    best: 'BEST',
    yourClicks: 'YOURS',
    topSignals: 'TOP COUNTRIES',
    noSignals: 'No signals yet. Be the first.',
    yourSignal: 'YOUR SIGNAL',
    localPreview: 'Local preview',
    captionTitle: 'SANCTVS TIBO',
    captionSub: 'GIVER OF TOKENS. RESETER OF LIMITS.',
    footer: 'A community petition. Counts are real. Resets are not guaranteed.',
    privacy: 'Only aggregate country and region counts are stored. No IPs, cookies, or user agents.',
    soundOn: 'Mute sound',
    soundOff: 'Enable sound',
    languageLabel: '中文',
    topRegion: 'TOP REGION TODAY',
    topRegionNone: 'No region yet today',
    tiers: ['WARM', 'HOT', 'UNHINGED', 'CANONIZED'],
    imageAlt:
      'An illuminated manuscript portrait of Saint Tibo, holding tokens and a RESET coin.',
  },
  zh: {
    metaTitle: 'DimAgent，给我们一次 RESET。',
    metaDescription: '为一个 DimAgent reset 请愿。每次点击按地区计数。Tibo 圣徒掌管 token。',
    brandSub: 'RESET 请愿',
    live: '实时',
    connecting: '连接中',
    retrying: '重连中',
    offline: '离线',
    syncing: '同步中',
    error: '同步失败',
    headlineBrand: 'DIMAGENT，',
    headlineBefore: '求一次 ',
    headlineAccent: 'RESET',
    headlineAfter: '。',
    subline: 'Tibo 圣徒发币，我们只负责计数。每次点击都会按地区记进总账。',
    button: '求一次 RESET',
    buttonAria: '申请一次 reset',
    totalLabel: 'RESET 申请',
    today: '今日',
    last5m: '近 5 分钟',
    countries: '覆盖地区',
    streak: '连击',
    best: '最高',
    yourClicks: '你的点击',
    topSignals: '点击最多的国家',
    noSignals: '还没有信号',
    yourSignal: '你的位置',
    localPreview: '本地预览',
    captionTitle: 'SANCTVS TIBO',
    captionSub: 'GIVER OF TOKENS. RESETER OF LIMITS.',
    footer: '社区请愿。计数是真的，RESET 不保证。',
    privacy: '只保存国家与地区汇总计数，不保存 IP、Cookie 或浏览器信息。',
    soundOn: '关闭音效',
    soundOff: '开启音效',
    languageLabel: 'English',
    topRegion: '今日最热地区',
    topRegionNone: '今日暂无地区数据',
    tiers: ['热身', '火热', '失控', '封圣'],
    imageAlt: '圣徒 Tibo 的泥金手抄本肖像，手持 token 和 RESET 硬币。',
  },
}

const LOCALE_KEY = 'dim-reset.locale'

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch {
    // Storage can be unavailable in private modes. Browser language is enough.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Ignore unavailable storage.
  }
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(value)
}

const displayNames = new Map<Locale, Intl.DisplayNames>()

export function countryName(code: string, locale: Locale): string {
  if (code === 'XX') return locale === 'zh' ? '未知' : 'Unknown'
  try {
    let names = displayNames.get(locale)
    if (!names) {
      names = new Intl.DisplayNames([locale === 'zh' ? 'zh-CN' : 'en'], { type: 'region' })
      displayNames.set(locale, names)
    }
    return names.of(code) ?? code
  } catch {
    return code
  }
}

export function countryFlag(code: string): string {
  if (code === 'XX' || !/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)))
}

export function formatLocation(
  country: string | null,
  region: string | null,
  locale: Locale,
): string {
  if (!country) return locale === 'zh' ? '未知' : 'Unknown'
  const name = countryName(country, locale)
  return region ? `${region}, ${name}` : name
}
