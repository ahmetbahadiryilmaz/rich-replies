import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Tıklamayla açılan görev ayrıntıları: { "<mesaj>:<blok>:<satır>": true }. Oturumluk, mesaj başına ayrı.
const acikDurum = atom({ plugin: 'rich-replies', key: 'acik' } as const, {} as Record<string, boolean>)

export function acikAnahtar(mesaj: string, blok: number, satir: number): string {
  return `${mesaj}:${blok}:${satir}`
}

export function acikDegistir(m: Record<string, boolean>, anahtar: string): Record<string, boolean> {
  const yeni = { ...m }
  if (yeni[anahtar]) delete yeni[anahtar]
  else yeni[anahtar] = true
  return yeni
}

// Ad -> hex: tema bağımsız, her yüzeyde aynı görünür. Listede olmayan ad olduğu gibi geçer.
const RENKLER: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  blue: '#3b82f6',
  gray: '#9ca3af',
  grey: '#9ca3af',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

const SPAN = /<span\s+style=(["'])\s*color\s*:\s*([^;"'<>]+?)\s*;?\s*\1\s*>([\s\S]*?)<\/span>/gi
const KALAN_ETIKET = /<\/?span\b[^>]*>/gi
const ON_KONTROL = /<span\s+style=/i
const FENCE = /^\s{0,3}(```|~~~)/
const TABLO_SATIRI = /^\s*\|/

export type Parca = { metin: string; renk?: string }
// Tablo hücresi parçası: renk + satır içi biçim.
export type Seg = { t: string; renk?: string; bold?: boolean; mono?: boolean }
export type Hiza = 'l' | 'c' | 'r'
export type Blok =
  | { tur: 'duz'; metin: string }
  | { tur: 'renkli'; satir: string }
  | { tur: 'gorev'; satirlar: string[]; ham: string; tablo: boolean }
  | { tur: 'tablo'; baslik: Seg[][]; hiza: Hiza[]; govde: Seg[][][]; ham: string }
  | { tur: 'resim'; alt: string; yol: string; ham: string }

// Kendi satırında duran yerel resim: ![alt](C:\yol\a.png) ya da ![alt](file:///C:/yol/a.png).
// Yalnız sürücü harfli mutlak yol; https: vb. eşleşmez (ağ yok, olduğu gibi kalır).
export const RESIM_SATIR =
  /^\s*!\[([^\]]*)\]\(\s*<?((?:file:\/\/\/)?[A-Za-z]:[\\/][^)<>"]*?\.(?:png|jpe?g|gif|webp))>?\s*(?:"[^"]*")?\s*\)\s*$/i
const RESIM_ON_KONTROL = /^\s*!\[[^\]]*\]\(\s*<?(?:file:\/\/\/)?[A-Za-z]:[\\/]/m

// ```gorev bloğu: ilerleme çubuklu görev satırları.
// "gorev tablo" bilgisi ya da bloğun ilk satırı "#! tablo" -> sütunlu görünüm.
const GOREV_ACILIS = /^\s{0,3}(```|~~~)\s*gorev(\s+tablo)?\s*$/i
const GOREV_ON_KONTROL = /^\s{0,3}(```|~~~)\s*gorev(\s+tablo)?\s*$/im
const TABLO_ISARET = /^\s*#!\s*tablo\s*$/i
const DURUM_EMOJI_VAR = /🟢|🟡|🔵|🟣|⚪|🔴/
const DURUM_EMOJI_BAS = /^\s*(?:🟢|🟡|🔵|🟣|⚪|🔴)/
const AYIRAC = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
export const HUCRE_MAX = 40
export const TABLO_CUBUK = 20

// Durum emojisi -> durum rengi (emoji yanında) ve çubuk tonları.
// Çubuk: tema bilgisi yüzeyden gelmediği için iki temada da aynı okunan SABİT koyu tonlar;
// dolu kısım üstünde beyaz, iz üstünde açık gri yazı (yazı rengi açıkça verilir).
export const DURUMLAR: Record<string, { renk: string; dolu: string }> = {
  '🟢': { renk: '#22c55e', dolu: '#15803d' },
  '🟡': { renk: '#eab308', dolu: '#a16207' },
  '🔵': { renk: '#3b82f6', dolu: '#1d4ed8' },
  '🟣': { renk: '#a855f7', dolu: '#7e22ce' },
  '⚪': { renk: '#9ca3af', dolu: '#6b7280' },
  '🔴': { renk: '#ef4444', dolu: '#b91c1c' },
}
const BILINMEYEN = DURUMLAR['⚪']!
export const IZ_ARKA = '#1f2937'
export const IZ_YAZI = '#d1d5db'
export const DOLU_YAZI = '#ffffff'
export const CUBUK_MIN = 56
export const CUBUK_MAX = 72

export type GorevSatiri =
  | { tur: 'baslik'; metin: string }
  | { tur: 'duz'; metin: string }
  | { tur: 'gorev'; emoji: string; yuzde: number | null; gorev: string; durum: string; kim: string; ipucu: string }

// Bir satırı çözer; çözülemezse düz metin olarak döner (içerik kaybolmaz).
export function gorevSatiriCoz(ham: string): GorevSatiri | null {
  const satir = ham.trim()
  if (!satir) return null
  if (satir.startsWith('#')) return { tur: 'baslik', metin: satir.replace(/^#+\s*/, '') }
  const alan = satir.split('|').map(a => a.trim())
  if (alan.length < 2) return { tur: 'duz', metin: ham }
  const ilk = (alan[0] ?? '').split(/\s+/)
  if (ilk.length !== 2) return { tur: 'duz', metin: ham }
  const emoji = (ilk[0] ?? '').replace(/️/g, '')
  const y = ilk[1] ?? ''
  let yuzde: number | null
  if (y === '-') yuzde = null
  else if (/^-?\d+(\.\d+)?$/.test(y)) yuzde = Math.min(100, Math.max(0, Math.round(Number(y))))
  else return { tur: 'duz', metin: ham }
  return { tur: 'gorev', emoji, yuzde, gorev: alan[1] ?? '', durum: alan[2] ?? '', kim: alan[3] ?? '', ipucu: alan.slice(4).join(' | ').trim() }
}

// Çubuk metni: " Görev — durum · kim · %90", görev adı kırpılır, genişlik sabit.
export function etiketYap(g: Extract<GorevSatiri, { tur: 'gorev' }>, genislik: number): string {
  const kuyruk =
    (g.durum ? ` — ${g.durum}` : '') + (g.kim ? ` · ${g.kim}` : '') + (g.yuzde !== null ? ` · %${g.yuzde}` : '')
  const bos = genislik - 1 - kuyruk.length
  let ad = g.gorev
  let metin: string
  if (bos >= 2) {
    if (ad.length > bos) ad = ad.slice(0, bos - 1) + '…'
    metin = ` ${ad}${kuyruk}`
  } else {
    metin = ` ${ad}${kuyruk}`
    if (metin.length > genislik) metin = metin.slice(0, genislik - 1) + '…'
  }
  return metin.padEnd(genislik, ' ')
}

// Tıklayınca açılan ayrıntı: 5. alan varsa o, yoksa kırpılmamış satır.
export function ipucuMetni(g: Extract<GorevSatiri, { tur: 'gorev' }>): string {
  return g.ipucu || etiketYap(g, 10_000).trim()
}


// Bloktaki tüm satırlar için ortak genişlik.
export function cubukGenislik(satirlar: GorevSatiri[]): number {
  let en = 0
  for (const g of satirlar) {
    if (g.tur !== 'gorev') continue
    const u = etiketYap(g, 10_000).trimEnd().length
    if (u > en) en = u
  }
  return Math.min(CUBUK_MAX, Math.max(CUBUK_MIN, en))
}

function renkCoz(ham: string): string | undefined {
  const r = ham.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(r)) return r
  if (/^[a-z]+$/.test(r)) return RENKLER[r] ?? r
  return undefined
}

// Satırdaki etiketleri atıp düz metin bırakır.
function etiketSil(satir: string): string {
  return satir
    .replace(SPAN, (_m, _q, _r, ic: string) => ic)
    .replace(KALAN_ETIKET, '')
}

// Satırı renkli/renksiz parçalara böler.
export function parcala(satir: string): Parca[] {
  const out: Parca[] = []
  let son = 0
  for (const m of satir.matchAll(SPAN)) {
    const i = m.index ?? 0
    if (i > son) out.push({ metin: satir.slice(son, i) })
    out.push({ metin: m[3] ?? '', renk: renkCoz(m[2] ?? '') })
    son = i + m[0].length
  }
  if (son < satir.length) out.push({ metin: satir.slice(son) })
  return out.map(p => ({ ...p, metin: p.metin.replace(KALAN_ETIKET, '') }))
}

// Görünür genişlik: emoji 2 hücre, varyasyon seçici 0.
export function gen(s: string): number {
  let n = 0
  for (const c of s) {
    const k = c.codePointAt(0) ?? 0
    if (k === 0xfe0f) continue
    n += k >= 0x1f300 || k === 0x26aa || k === 0x26ab ? 2 : 1
  }
  return n
}

export function segGen(segs: Seg[]): number {
  return segs.reduce((a, s) => a + gen(s.t), 0)
}

// En çok `max` hücre; fazlası … ile kesilir.
export function kirpSeg(segs: Seg[], max: number): Seg[] {
  if (segGen(segs) <= max) return segs
  const out: Seg[] = []
  let kalan = Math.max(0, max - 1)
  for (const s of segs) {
    if (kalan <= 0) break
    let t = ''
    for (const c of s.t) {
      const w = gen(c)
      if (w > kalan) {
        kalan = 0
        break
      }
      t += c
      kalan -= w
    }
    if (t) out.push({ ...s, t })
  }
  out.push({ ...(out[out.length - 1] ?? {}), t: '…' })
  return out
}

// Hizaya göre baştan boşluk ekler (sağa/ortaya).
export function hizala(segs: Seg[], w: number, hiza: Hiza): Seg[] {
  const eksik = w - segGen(segs)
  const bas = hiza === 'r' ? eksik : hiza === 'c' ? Math.floor(eksik / 2) : 0
  return bas > 0 ? [{ t: ' '.repeat(bas) }, ...segs] : segs
}

// Hücre metni -> renkli parçalar.
export function hucreSeg(h: string): Seg[] {
  return parcala(h).flatMap(p => satirIci(p.metin).map(s => ({ t: s.t, renk: p.renk, bold: s.bold, mono: s.mono })))
}

// Tablo satırını hücrelere böler (\| kaçışı korunur).
export function hucreBol(satir: string): string[] {
  let s = satir.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (c === '|') {
      out.push(cur.trim())
      cur = ''
    } else cur += c
  }
  out.push(cur.trim())
  return out
}

// Sütun genişlikleri: en uzun hücre, üst sınırlı.
export function sutunGenislikleri(sat: Seg[][][], n: number, max = HUCRE_MAX): number[] {
  const w: number[] = []
  for (let c = 0; c < n; c++) {
    let en = 1
    for (const r of sat) en = Math.max(en, segGen(r[c] ?? []))
    w.push(Math.min(max, en))
  }
  return w
}

// Başlık+ayraç ile başlayan GFM tablosunu çözer; renk/durum emojisi yoksa null (motor çizer).
export function tabloCoz(satirlar: string[]): Extract<Blok, { tur: 'tablo' }> | null {
  const hs = hucreBol(satirlar[0] ?? '')
  const n = hs.length
  const hiza = hucreBol(satirlar[1] ?? '').map((a): Hiza => (a.startsWith(':') && a.endsWith(':') ? 'c' : a.endsWith(':') ? 'r' : 'l'))
  const govdeHam = satirlar.slice(2).map(hucreBol)
  const renkli = [hs, ...govdeHam].some(r => r.some(c => ON_KONTROL.test(c) || DURUM_EMOJI_BAS.test(c)))
  if (!renkli) return null
  const duzelt = (r: string[]) => Array.from({ length: n }, (_, i) => hucreSeg(r[i] ?? ''))
  return {
    tur: 'tablo',
    baslik: duzelt(hs),
    hiza: Array.from({ length: n }, (_, i) => hiza[i] ?? 'l'),
    govde: govdeHam.map(duzelt),
    ham: satirlar.join('\n'),
  }
}

// Mesajı bloklara ayırır. Kod bloğu içi ve tablo satırları dokunulmadan/etiketsiz düz kalır.
export function bloklaraBol(text: string): Blok[] {
  const bloklar: Blok[] = []
  let duz: string[] = []
  let fence: string | null = null
  let gorev: { satirlar: string[]; ham: string[]; tablo: boolean } | null = null
  const gorevBlok = (g: { satirlar: string[]; ham: string[]; tablo: boolean }): Blok => {
    let satirlar = g.satirlar
    let tablo = g.tablo
    const ilk = satirlar.findIndex(x => x.trim() !== '')
    if (ilk >= 0 && TABLO_ISARET.test(satirlar[ilk] as string)) {
      tablo = true
      satirlar = satirlar.filter((_, k) => k !== ilk)
    }
    return { tur: 'gorev', satirlar, ham: g.ham.join('\n'), tablo }
  }
  const duzuBosalt = () => {
    if (duz.length) bloklar.push({ tur: 'duz', metin: duz.join('\n') })
    duz = []
  }
  const hamSatirlar = text.split('\n')
  for (let i = 0; i < hamSatirlar.length; i++) {
    const satir = hamSatirlar[i] as string
    const f = FENCE.exec(satir)
    // Açık ```gorev bloğu: kapanışa kadar satırlar toplanır.
    if (gorev !== null) {
      gorev.ham.push(satir)
      if (f && f[1] === fence) {
        bloklar.push(gorevBlok(gorev))
        gorev = null
        fence = null
      } else gorev.satirlar.push(satir)
      continue
    }
    if (fence === null && GOREV_ACILIS.test(satir)) {
      duzuBosalt()
      fence = f?.[1] ?? '```'
      gorev = { satirlar: [], ham: [satir], tablo: !!GOREV_ACILIS.exec(satir)?.[2] }
      continue
    }
    if (fence !== null) {
      duz.push(satir)
      if (f && f[1] === fence) fence = null
      continue
    }
    if (f) {
      fence = f[1] ?? null
      duz.push(satir)
      continue
    }
    const rs = RESIM_SATIR.exec(satir)
    if (rs) {
      duzuBosalt()
      bloklar.push({ tur: 'resim', alt: rs[1] ?? '', yol: resimYoluCoz(rs[2] ?? ''), ham: satir })
      continue
    }
    // GFM tablosu: başlık + ayraç satırı. Renk/durum emojisi varsa kendimiz çizeriz.
    if (satir.includes('|') && AYIRAC.test(hamSatirlar[i + 1] ?? '') && (hamSatirlar[i + 1] ?? '').includes('-')) {
      let j = i + 2
      while (j < hamSatirlar.length) {
        const x = hamSatirlar[j] as string
        if (x.trim() === '' || !x.includes('|') || FENCE.test(x)) break
        j++
      }
      const t = tabloCoz(hamSatirlar.slice(i, j))
      if (t) {
        duzuBosalt()
        bloklar.push(t)
      } else {
        for (const x of hamSatirlar.slice(i, j)) duz.push(etiketSil(x))
      }
      i = j - 1
      continue
    }
    if (!ON_KONTROL.test(satir)) {
      duz.push(satir.replace(KALAN_ETIKET, ''))
      continue
    }
    if (TABLO_SATIRI.test(satir)) {
      // Tablo hücresinde renk desteklenmez: etiket silinir, düz metin kalır.
      duz.push(etiketSil(satir))
      continue
    }
    duzuBosalt()
    bloklar.push({ tur: 'renkli', satir })
  }
  // Kapanmamış ```gorev (akış sürüyor): şimdiye kadarki satırlar yine çizilir.
  const acik = gorev as { satirlar: string[]; ham: string[]; tablo: boolean } | null
  if (acik !== null) bloklar.push(gorevBlok(acik))
  duzuBosalt()
  return bloklar
}

// Kod bloğu dışındaki kalan etiketleri silmek için: renkli satır yoksa metin yine de temizlenir.
export function temizle(text: string): string {
  return bloklaraBol(text)
    .map(b => (b.tur === 'duz' ? b.metin : b.tur === 'gorev' || b.tur === 'resim' || b.tur === 'tablo' ? b.ham : etiketSil(b.satir)))
    .join('\n')
}

type Bicim = { bold?: boolean; italic?: boolean; mono?: boolean }

// Renkli satırda satır içi biçimi (**kalın**, `kod`, [ad](url)) küçük bir ayrıştırıcıyla çözer.
function satirIci(metin: string): Array<{ t: string } & Bicim> {
  const out: Array<{ t: string } & Bicim> = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g
  let son = 0
  for (const m of metin.matchAll(re)) {
    const i = m.index ?? 0
    if (i > son) out.push({ t: metin.slice(son, i) })
    if (m[1] !== undefined) out.push({ t: m[1], bold: true })
    else if (m[2] !== undefined) out.push({ t: m[2], mono: true })
    else out.push({ t: m[3] ?? '' })
    son = i + m[0].length
  }
  if (son < metin.length) out.push({ t: metin.slice(son) })
  return out
}

// ---- Yerel resim ----

export const GOSTERIM_EN_MAX = 640
// Svg.source üst sınırı 131072 karakter; base64 şişmesi (x4/3) yüzünden ham dosya en çok ~98 KB olur.
export const SVG_MAX = 131072
// Terminalde Image kaynağı en çok 2 MiB (çözülmüş) alır.
export const TERMINAL_MAX = 2 * 1024 * 1024

export type Bicimi = 'png' | 'jpeg' | 'gif' | 'webp'
export type Resim = { bicim: Bicimi; en: number; boy: number; bayt: number; base64: string }
export type ResimSonuc = { ok: true; resim: Resim } | { ok: false; neden: string }

// file:///C:/a%20b.png -> C:/a b.png
export function resimYoluCoz(ham: string): string {
  let y = ham.trim()
  if (/^file:\/\/\//i.test(y)) {
    y = y.slice(8)
    try {
      y = decodeURIComponent(y)
    } catch {
      /* çözülemezse olduğu gibi */
    }
  }
  return y
}

export function dosyaAdi(yol: string): string {
  return yol.split(/[\\/]/).pop() || yol
}

export function boyutMetni(bayt: number): string {
  return bayt >= 1024 * 1024 ? `${(bayt / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bayt / 1024))} KB`
}

export function base64Bayt(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - pad
}

function ikili(b64: string): Uint8Array {
  const s = atob(b64)
  const u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return u
}

// Biçim ve boyut ilk baytlardan: PNG IHDR, JPEG SOF, GIF başlığı, WebP VP8/VP8L/VP8X.
export function resimBoyutu(b: Uint8Array): { bicim: Bicimi; en: number; boy: number } | null {
  const u16 = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0)
  const u32 = (i: number) => (u16(i) * 65536 + u16(i + 2)) >>> 0
  const l16 = (i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8)
  const l24 = (i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16)
  const yaz = (i: number, n: number) => {
    let s = ''
    for (let k = i; k < i + n; k++) s += String.fromCharCode(b[k] ?? 0)
    return s
  }
  if (b.length >= 24 && u32(0) === 0x89504e47 && u32(4) === 0x0d0a1a0a && yaz(12, 4) === 'IHDR') {
    return { bicim: 'png', en: u32(16), boy: u32(20) }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const m = b[i + 1] ?? 0
      if (m === 0xff) {
        i++
        continue
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2
        continue
      }
      // SOF0-SOF15 (DHT 0xC4, JPG 0xC8, DAC 0xCC hariç): sırayla boy, en
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { bicim: 'jpeg', boy: u16(i + 5), en: u16(i + 7) }
      }
      i += 2 + u16(i + 2)
    }
    return null
  }
  if (b.length >= 10 && yaz(0, 4) === 'GIF8') return { bicim: 'gif', en: l16(6), boy: l16(8) }
  if (b.length >= 30 && yaz(0, 4) === 'RIFF' && yaz(8, 4) === 'WEBP') {
    const t = yaz(12, 4)
    if (t === 'VP8X') return { bicim: 'webp', en: l24(24) + 1, boy: l24(27) + 1 }
    if (t === 'VP8L') {
      const v = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)
      return { bicim: 'webp', en: (v & 0x3fff) + 1, boy: ((v >>> 14) & 0x3fff) + 1 }
    }
    if (t === 'VP8 ') return { bicim: 'webp', en: l16(26) & 0x3fff, boy: l16(28) & 0x3fff }
  }
  return null
}

// Gösterim ölçüsü: en çok 640 geniş, oran korunur, küçük resim büyütülmez.
export function gosterimOlcusu(en: number, boy: number): { w: number; h: number } {
  const w = Math.min(GOSTERIM_EN_MAX, en)
  return { w, h: Math.max(1, Math.round((boy * w) / en)) }
}

export function svgYap(r: Resim): { source: string; w: number; h: number } {
  const { w, h } = gosterimOlcusu(r.en, r.boy)
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<image href="data:image/${r.bicim};base64,${r.base64}" width="${w}" height="${h}"/></svg>`
  return { source, w, h }
}

// Aynı dosya tekrar okunmasın: başarılı sonuçlar kısa süre bellekte tutulur (mod yeniden yüklenince sıfırlanır).
const ONBELLEK = new Map<string, { t: number; p: Promise<ResimSonuc> }>()
const ONBELLEK_OMUR = 60_000

type BaytOkuyucu = { fs: { read: (p: string, o: { as: 'bytes' }) => Promise<{ base64: string }> } }

export async function resimOku($: BaytOkuyucu, yol: string): Promise<ResimSonuc> {
  const simdi = Date.now()
  const eski = ONBELLEK.get(yol)
  if (eski && simdi - eski.t < ONBELLEK_OMUR) return eski.p
  const p = (async (): Promise<ResimSonuc> => {
    let base64: string
    try {
      base64 = (await $.fs.read(yol, { as: 'bytes' })).base64
    } catch (err) {
      const m = String((err as { message?: unknown } | null)?.message ?? err)
      if (/ENOENT|not found|no such|does not exist|missing/i.test(m)) return { ok: false, neden: 'bulunamadı' }
      if (/MiB|too large|too big|exceed/i.test(m)) return { ok: false, neden: 'büyük: 4 MB üstü' }
      return { ok: false, neden: 'okunamadı' }
    }
    const bayt = base64Bayt(base64)
    let olcu: ReturnType<typeof resimBoyutu> = null
    try {
      olcu = resimBoyutu(ikili(base64))
    } catch {
      olcu = null
    }
    if (!olcu || olcu.en < 1 || olcu.boy < 1) return { ok: false, neden: 'resim çözülemedi' }
    return { ok: true, resim: { ...olcu, bayt, base64 } }
  })()
  ONBELLEK.set(yol, { t: simdi, p })
  // Başarısız sonuç önbellekte kalmaz: dosya sonradan oluşabilir.
  void p.then(s => {
    if (!s.ok && ONBELLEK.get(yol)?.p === p) ONBELLEK.delete(yol)
  })
  return p
}

// Satırın yerine geçen tek satırlık yer tutucu.
export function yerTutucu(yol: string, neden: string): string {
  return `🖼 ${dosyaAdi(yol)} (${neden})`
}

// Satır başı işaretini (başlık, liste, alıntı) ayırır.
function onEk(satir: string): { girinti: string; isaret: string; govde: string; baslik: boolean } {
  const m = /^(\s*)(?:(#{1,6})\s+|([-*+])\s+|(\d+[.)])\s+|(>)\s?)?([\s\S]*)$/.exec(satir)
  const girinti = m?.[1] ?? ''
  const isaret = m?.[3] ? '• ' : m?.[4] ? `${m[4]} ` : m?.[5] ? '│ ' : ''
  return { girinti, isaret, govde: m?.[6] ?? satir, baslik: !!m?.[2] }
}

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    // Yalnız vscode ve terminal; işaret yoksa hiçbir şeye dokunulmaz.
    if (e.surface !== 'vscode' && e.surface !== 'terminal') return next(e)
    const text = e.props.text
    if (!ON_KONTROL.test(text) && !GOREV_ON_KONTROL.test(text) && !RESIM_ON_KONTROL.test(text) && !DURUM_EMOJI_VAR.test(text)) return next(e)

    const bloklar = bloklaraBol(text)
    if (!bloklar.some(b => b.tur !== 'duz')) {
      // Renkli satır yok (yalnız tablo/kod içi): doğal markdown, etiketsiz.
      const yeni = temizle(text)
      return yeni === text ? next(e) : next({ ...e, props: { ...e.props, text: yeni } })
    }

    // Resimler çizimden önce okunur (hook asenkron olabilir); aynı yol bir kez okunur.
    const resimler = new Map<string, ResimSonuc>()
    for (const b of bloklar) {
      if (b.tur === 'resim' && !resimler.has(b.yol)) resimler.set(b.yol, await resimOku($, b.yol))
    }

    // Açık ayrıntılar (tıklamayla): yalnız görev bloğu varsa okunur; okuma çizimi abone eder.
    const acik = bloklar.some(b => b.tur === 'gorev') ? await read($, acikDurum) : {}

    const { Box, Text, Markdown, Button } = $.ui.resolve(e)
    // Hücre içeriği: renkli parçalar.
    const segler = (segs: Seg[], bold?: boolean) =>
      segs.map((s, k) => (
        <Text key={`s${k}`} color={s.renk} bold={bold || s.bold || undefined} mono={s.mono}>
          {s.t}
        </Text>
      ))
    // Sabit genişlikli hücre (iki boşluk sütun aralığı).
    const hucre = (key: string, w: number, icerik: any) => (
      <Box key={key} width={w + 2}>
        {icerik}
      </Box>
    )
    return (
      <Box flexDirection="column">
        {bloklar.map((b, i) => {
          if (b.tur === 'duz') return <Markdown key={`b${i}`} text={b.metin} />
          if (b.tur === 'resim') {
            const sonuc = resimler.get(b.yol)
            if (!sonuc || !sonuc.ok) return <Text key={`b${i}`}>{yerTutucu(b.yol, sonuc?.neden ?? 'okunamadı')}</Text>
            const r = sonuc.resim
            const alt = b.alt || dosyaAdi(b.yol)
            if (e.surface === 'terminal') {
              // Terminalde Svg yok: yalnız PNG, Image elemanıyla (hücre ~8x16 px).
              if (r.bicim !== 'png') return <Text key={`b${i}`}>{yerTutucu(b.yol, 'terminalde yalnız PNG')}</Text>
              if (r.bayt > TERMINAL_MAX) return <Text key={`b${i}`}>{yerTutucu(b.yol, `büyük: ${boyutMetni(r.bayt)}`)}</Text>
              const olcu = gosterimOlcusu(r.en, r.boy)
              const kolon = Math.max(1, Math.min(80, Math.ceil(olcu.w / 8)))
              const satir = Math.max(1, Math.min(255, Math.ceil((olcu.h * ((kolon * 8) / olcu.w)) / 16)))
              const { Image } = $.ui.resolve(e)
              return <Image key={`b${i}`} source={{ png: r.base64 }} columns={kolon} rows={satir} alt={alt} />
            }
            const { Svg } = $.ui.resolve(e)
            const svg = svgYap(r)
            if (svg.source.length > SVG_MAX) return <Text key={`b${i}`}>{yerTutucu(b.yol, `büyük: ${boyutMetni(r.bayt)}`)}</Text>
            return <Svg key={`b${i}`} source={svg.source} alt={alt} width={svg.w} height={svg.h} />
          }
          if (b.tur === 'tablo') {
            // Sabit sütun genişlikli ızgara: başlık kalın, ince ayraç, renkli hücreler.
            const n = b.baslik.length
            const w = sutunGenislikleri([b.baslik, ...b.govde], n)
            const sat = (r: Seg[][], anahtar: string, baslik: boolean) => (
              <Box key={anahtar} flexDirection="row">
                {r.map((c, k) =>
                  hucre(`h${k}`, w[k] ?? 1, <Text>{segler(hizala(kirpSeg(c, w[k] ?? 1), w[k] ?? 1, b.hiza[k] ?? 'l'), baslik)}</Text>),
                )}
              </Box>
            )
            const toplam = w.reduce((a, x) => a + x + 2, 0)
            return (
              <Box key={`b${i}`} flexDirection="column">
                {sat(b.baslik, 'bas', true)}
                <Text dimColor>{'─'.repeat(Math.max(1, toplam - 2))}</Text>
                {b.govde.map((r, j) => sat(r, `r${j}`, false))}
              </Box>
            )
          }
          if (b.tur === 'gorev' && b.tablo) {
            // Sütunlu görünüm: Durum | Görev | Durum metni | Kim | İlerleme.
            const cozulen = b.satirlar.map(gorevSatiriCoz).filter((g): g is GorevSatiri => g !== null)
            const gs = cozulen.filter((g): g is Extract<GorevSatiri, { tur: 'gorev' }> => g.tur === 'gorev')
            const BASLIK = ['Durum', 'Görev', 'Durum metni', 'Kim', 'İlerleme']
            const en = (basl: string, f: (g: Extract<GorevSatiri, { tur: 'gorev' }>) => string, max: number) =>
              Math.min(max, Math.max(gen(basl), ...gs.map(g => gen(f(g)))))
            const w = [
              5,
              en('Görev', g => g.gorev, HUCRE_MAX),
              en('Durum metni', g => g.durum, 20),
              en('Kim', g => g.kim, 16),
              TABLO_CUBUK + 5,
            ]
            const duzHucre = (key: string, k: number, metin: string, renk?: string, kalin?: boolean) =>
              hucre(
                key,
                w[k] as number,
                <Text color={renk} bold={kalin || undefined}>
                  {kirpSeg([{ t: metin }], w[k] as number).map(s => s.t).join('')}
                </Text>,
              )
            return (
              <Box key={`b${i}`} flexDirection="column">
                <Box flexDirection="row">{BASLIK.map((t, k) => duzHucre(`h${k}`, k, t, undefined, true))}</Box>
                <Text dimColor>{'─'.repeat(w.reduce((a, x) => a + x + 2, 0) - 2)}</Text>
                {cozulen.map((g, j) => {
                  if (g.tur === 'baslik') return <Text key={`g${j}`} bold>{g.metin}</Text>
                  if (g.tur === 'duz') return <Text key={`g${j}`}>{g.metin}</Text>
                  const d = DURUMLAR[g.emoji] ?? BILINMEYEN
                  const n = g.yuzde === null ? 0 : Math.round((TABLO_CUBUK * g.yuzde) / 100)
                  const anahtar = acikAnahtar(e.requestId, i, j)
                  const acikMi = acik[anahtar] === true
                  return (
                    <Box key={`g${j}`} flexDirection="column">
                      <Box flexDirection="row">
                        {duzHucre('d', 0, g.emoji, d.renk)}
                        {duzHucre('g', 1, g.gorev, d.renk)}
                        {duzHucre('u', 2, g.durum)}
                        {duzHucre('k', 3, g.kim)}
                        {hucre(
                          'i',
                          w[4] as number,
                          <Text>
                            {n > 0 ? <Text color={DOLU_YAZI} backgroundColor={d.dolu}>{' '.repeat(n)}</Text> : null}
                            {n < TABLO_CUBUK ? <Text color={IZ_YAZI} backgroundColor={IZ_ARKA}>{' '.repeat(TABLO_CUBUK - n)}</Text> : null}
                            {g.yuzde === null ? ' -' : ` %${g.yuzde}`}
                          </Text>,
                        )}
                        {g.ipucu ? (
                          <Button
                            key={`t${j}`}
                            label={acikMi ? '▾' : '▸'}
                            onPress={() => void update($, acikDurum, m => acikDegistir(m, anahtar))}
                          />
                        ) : null}
                      </Box>
                      {g.ipucu && acikMi ? <Text dimColor>{'   ' + g.ipucu}</Text> : null}
                    </Box>
                  )
                })}
              </Box>
            )
          }
          if (b.tur === 'gorev') {
            const cozulen = b.satirlar.map(gorevSatiriCoz).filter((g): g is GorevSatiri => g !== null)
            const w = cubukGenislik(cozulen)
            return (
              <Box key={`b${i}`} flexDirection="column">
                {cozulen.map((g, j) => {
                  if (g.tur === 'baslik') return <Text key={`g${j}`} bold>{g.metin}</Text>
                  if (g.tur === 'duz') return <Text key={`g${j}`}>{g.metin}</Text>
                  const d = DURUMLAR[g.emoji] ?? BILINMEYEN
                  const etiket = etiketYap(g, w)
                  const n = g.yuzde === null ? 0 : Math.round((w * g.yuzde) / 100)
                  // Açık/kapalı durumu mesaj (requestId), blok ve satır sırasıyla anahtarlanır.
                  const anahtar = acikAnahtar(e.requestId, i, j)
                  const acikMi = acik[anahtar] === true
                  return (
                    <Box key={`g${j}`} flexDirection="column">
                      {/* Çubuk Box/Text ile çizilir (düğme stili çubuğu ezmesin); düğme yalnız 5. alan doluyken çubuğun sağında. */}
                      <Box flexDirection="row">
                        <Text>
                          {g.emoji + ' '}
                          {n > 0 ? <Text color={DOLU_YAZI} backgroundColor={d.dolu}>{etiket.slice(0, n)}</Text> : null}
                          {n < w ? <Text color={IZ_YAZI} backgroundColor={IZ_ARKA}>{etiket.slice(n)}</Text> : null}
                        </Text>
                        {g.ipucu ? (
                          <Button
                            key={`t${j}`}
                            label={acikMi ? '▾' : '▸'}
                            onPress={() => void update($, acikDurum, m => acikDegistir(m, anahtar))}
                          />
                        ) : null}
                      </Box>
                      {g.ipucu && acikMi ? <Text dimColor>{'   ' + g.ipucu}</Text> : null}
                    </Box>
                  )
                })}
              </Box>
            )
          }
          const { girinti, isaret, govde, baslik } = onEk(b.satir)
          return (
            <Text key={`b${i}`} bold={baslik || undefined}>
              {girinti + isaret}
              {parcala(govde).flatMap((p, j) =>
                satirIci(p.metin).map((s, k) => (
                  <Text
                    key={`${j}-${k}`}
                    color={p.renk}
                    bold={s.bold}
                    mono={s.mono}
                  >
                    {s.t}
                  </Text>
                )),
              )}
            </Text>
          )
        })}
      </Box>
    )
  })
}
