import { expect, test } from 'claude-code/testing'

const MSG = (text: string, surface: 'vscode' | 'terminal' | 'desktop' = 'vscode') =>
  ({
    plugin: 'rich-replies',
    component: 'AssistantMessage',
    surface,
    props: { text, isFirstOfReply: true },
  }) as const

// En içteki eşleşen Text (dış Text iç içe olanı da kapsar).
async function ic(ui: any, text: RegExp) {
  const hepsi = await ui.findAll({ type: 'Text', text })
  return hepsi[hepsi.length - 1]
}

// Motorun kendi çizimi: hook devretmişse bu görünür.
function motor($: any, on: any) {
  on('ui.render', ($: any, e: any) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={`MOTOR:${e.props.text}`} />
  })
}

test('spansız mesaj aynen motora geçer', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('# Başlık\n\n- madde\n\n| a | b |\n|---|---|\n| 1 | 2 |'))
  const md = await ui.find({ type: 'Markdown' })
  expect(md?.text).toBe('MOTOR:# Başlık\n\n- madde\n\n| a | b |\n|---|---|\n| 1 | 2 |')
  await ui.unmount()
})

test('tek renkli span renklenir', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('Merhaba <span style="color:red">dünya</span> nasılsın'))
  const t = await ic(ui, /dünya/)
  expect(t?.props?.color).toBe('#ef4444')
  expect(await ui.find({ type: 'Text', text: /<span/ })).toBeFalsy()
  await ui.unmount()
})

test('aynı satırda iki renk', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(
    MSG('<span style="color:green">iyi</span> ve <span style="color:blue">mavi</span>'),
  )
  expect((await ic(ui, /iyi/))?.props?.color).toBe('#22c55e')
  expect((await ic(ui, /mavi/))?.props?.color).toBe('#3b82f6')
  await ui.unmount()
})

test('kod bloğu içindeki span\'e dokunulmaz', async ($, on) => {
  motor($, on)
  const kod = '```html\n<span style="color:red">x</span>\n```'
  const ui = await $.ui.mount(MSG(kod))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:' + kod)
  await ui.unmount()

  const ui2 = await $.ui.mount(MSG(`${kod}\n\n<span style="color:red">dış</span>`))
  const md = await ui2.find({ type: 'Markdown', text: /```html/ })
  expect(md?.text).toContain('<span style="color:red">x</span>')
  expect((await ic(ui2, /dış/))?.props?.color).toBe('#ef4444')
  await ui2.unmount()
})

test('tabloda span artık ızgara olur (ayrıntılı test: tablo.test.tsx)', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(
    MSG('| a | b |\n|---|---|\n| <span style="color:red">x</span> | 2 |'),
  )
  expect(await ui.find({ type: 'Markdown' })).toBeFalsy()
  expect((await ic(ui, /^x$/))?.props?.color).toBe('#ef4444')
  await ui.unmount()
})

test('hex renk', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('<span style="color:#22c55e">yeşil</span>'))
  expect((await ic(ui, /yeşil/))?.props?.color).toBe('#22c55e')
  await ui.unmount()
})

test('diğer yüzeyde dokunulmaz', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('<span style="color:red">x</span>', 'desktop'))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:<span style="color:red">x</span>')
  await ui.unmount()
})

// ---- ```gorev blokları ----
const GOREV = (satirlar: string[]) => '```gorev\n' + satirlar.join('\n') + '\n```'
const ORNEK = GOREV([
  '# Kurumsal Panel',
  '🟣 90 | WhatsApp düğmesini kaldırmak | main\'de | sonnet ajan',
  '🟡 20 | Staging kontrolü | Sürüyor',
  '# Eğitim',
  '🟢 100 | Veri modeli | Bitti | sonnet ajan',
])

// Bir görev satırının iki çubuk parçası (dolu, iz) ve üst Text'i.
async function cubuklar(ui: any) {
  const hepsi = await ui.findAll({ type: 'Text' })
  return hepsi.filter((t: any) => t.props?.backgroundColor)
}

test('gorev bloğu: doğru satır sayısı ve başlıklar', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(ORNEK))
  expect(await ui.find({ type: 'Text', text: /^Kurumsal Panel$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Eğitim$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /WhatsApp düğmesi/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Staging/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Veri modeli/ })).toBeTruthy()
  expect(await ui.find({ type: 'Markdown', text: /MOTOR/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /```/ })).toBeFalsy()
  await ui.unmount()
})

test('gorev: %50 satırda dolu kısım genişliğin yarısı', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(GOREV(['🟡 50 | Yarım | Sürüyor'])))
  const c = await cubuklar(ui)
  expect(c.length).toBe(2)
  const dolu = c.find((t: any) => t.props.backgroundColor === '#a16207')
  const iz = c.find((t: any) => t.props.backgroundColor === '#1f2937')
  expect(dolu.text.length).toBe(28)
  expect(iz.text.length).toBe(28)
  expect(dolu.text.length + iz.text.length).toBe(56)
  await ui.unmount()
})

test('gorev: aynı blokta tüm satırlar aynı genişlikte', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(GOREV(['🟢 10 | Kısa | a', '🔴 80 | Çok daha uzun bir görev adı burada | durum | kim'])))
  const c = await cubuklar(ui)
  const toplam = (renk: string[]) =>
    c.filter((t: any) => renk.includes(t.props.backgroundColor)).reduce((a: number, t: any) => a + t.text.length, 0)
  expect(toplam(['#15803d', '#1f2937']) ).toBeGreaterThan(0)
  expect(c.length).toBe(4)
  const w1 = c[0].text.length + c[1].text.length
  const w2 = c[2].text.length + c[3].text.length
  expect(w1).toBe(w2)
  await ui.unmount()
})

test('gorev: emoji -> renk eşlemesi', async ($, on) => {
  motor($, on)
  const e: Record<string, string> = {
    '🟢': '#15803d', '🟡': '#a16207', '🔵': '#1d4ed8', '🟣': '#7e22ce', '⚪': '#6b7280', '🔴': '#b91c1c', '🟠': '#6b7280',
  }
  for (const [emoji, renk] of Object.entries(e)) {
    const ui = await $.ui.mount(MSG(GOREV([`${emoji} 100 | x | y`])))
    const c = await cubuklar(ui)
    expect(c.length).toBe(1)
    expect(c[0].props.backgroundColor).toBe(renk)
    await ui.unmount()
  }
})

test('gorev: yüzde - ise dolu kısım yok', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(GOREV(['🔴 - | Hata | Kaldı | haiku ajan'])))
  const c = await cubuklar(ui)
  expect(c.length).toBe(1)
  expect(c[0].props.backgroundColor).toBe('#1f2937')
  expect(c[0].text.length).toBe(56)
  expect(c[0].text).not.toMatch(/%/)
  await ui.unmount()
})

test('gorev: bozuk satır düz metin kalır', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(GOREV(['bu satır bozuk', '🟢 abc | x | y', '🟢 40 | iyi | Sürüyor'])))
  expect(await ui.find({ type: 'Text', text: /^bu satır bozuk$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^🟢 abc \| x \| y$/ })).toBeTruthy()
  expect((await cubuklar(ui)).length).toBe(2)
  await ui.unmount()
})

test('gorev bloğu ve span aynı mesajda', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(
    MSG('Selam <span style="color:red">kırmızı</span>\n\n' + GOREV(['🟢 100 | Bitti işi | Bitti'])),
  )
  expect((await ic(ui, /kırmızı/))?.props?.color).toBe('#ef4444')
  expect((await cubuklar(ui)).length).toBe(1)
  await ui.unmount()
})

test('gorev olmayan kod bloğuna dokunulmaz', async ($, on) => {
  motor($, on)
  const kod = '```js\n🟢 50 | x | y\n```'
  const ui = await $.ui.mount(MSG(kod))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:' + kod)
  const ui2 = await $.ui.mount(MSG('```\n🟢 50 | x | y\n```'))
  expect((await ui2.find({ type: 'Markdown' }))?.text).toBe('MOTOR:```\n🟢 50 | x | y\n```')
  expect((await cubuklar(ui2)).length).toBe(0)
  await ui.unmount()
  await ui2.unmount()
})

test('gorev: yüzde 0-100 arasına sıkıştırılır', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(GOREV(['🟢 250 | Taşan | a'])))
  const c = await cubuklar(ui)
  expect(c.length).toBe(1)
  expect(c[0].props.backgroundColor).toBe('#15803d')
  expect(c[0].text.length).toBe(56)
  await ui.unmount()
  const ui2 = await $.ui.mount(MSG(GOREV(['🟢 -30 | Eksi | a'])))
  const c2 = await cubuklar(ui2)
  expect(c2.length).toBe(1)
  expect(c2[0].props.backgroundColor).toBe('#1f2937')
  await ui2.unmount()
})

// ---- ayrıntı (tıklayınca açılır) ----
import { gorevSatiriCoz, ipucuMetni, acikAnahtar, acikDegistir } from './register'

const MSGID = (text: string, requestId: string) => ({ ...MSG(text), requestId }) as const

test('ayrıntı: 5. alan ayrıştırılır', async () => {
  const g: any = gorevSatiriCoz('🟢 10 | Ad | Sürüyor | sonnet | özel ipucu | devam')
  expect(g.ipucu).toBe('özel ipucu | devam')
  const uzun = 'Çok uzun bir görev adı '.repeat(6).trim()
  const g2: any = gorevSatiriCoz(`🟡 30 | ${uzun} | Sürüyor | haiku`)
  expect(g2.ipucu).toBe('')
  expect(ipucuMetni(g2)).toBe(`${uzun} — Sürüyor · haiku · %30`)
})

test('ayrıntı: anahtar mesaj+blok+satır, değiştirme aç/kapa', async () => {
  expect(acikAnahtar('m1', 2, 3)).toBe('m1:2:3')
  const a = acikDegistir({}, 'k')
  expect(a).toEqual({ k: true })
  expect(acikDegistir(a, 'k')).toEqual({})
})

test('ayrıntı: kapalıyken ağaçta yok, onPress ile açılır, ikinci onPress ile kapanır', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSGID(GOREV(['🟢 10 | Ad | Sürüyor | sonnet | özel ipucu']), 'm-a'))
  expect(await ui.find({ type: 'Text', text: /özel ipucu/ })).toBeFalsy()
  expect(await ui.find({ type: 'Box', }).then((b: any) => b?.props?.hover)).toBeFalsy()
  const dugme = await ui.find({ type: 'Button' })
  expect(dugme).toBeTruthy()
  await ui.press({ key: dugme!.key ?? 't0' })
  expect(await ui.find({ type: 'Text', text: /özel ipucu/ })).toBeTruthy()
  await ui.press({ key: dugme!.key ?? 't0' })
  expect(await ui.find({ type: 'Text', text: /özel ipucu/ })).toBeFalsy()
  await ui.unmount()
})

test('ayrıntı: düğme yalnız 5. alanı dolu satırda; boş satırda düğme ve işaret yok; çubuk düğme değil', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(
    MSGID(GOREV(['🟡 80 | Boş satır | Sürüyor | haiku', '🟢 10 | B | x | y | not']), 'm-b'),
  )
  expect((await ui.findAll({ type: 'Button' })).length).toBe(1)
  const dg: any = await ui.find({ type: 'Button' })
  expect(String(dg?.props?.label ?? dg?.text)).toBe('▸')
  // Çubuklar hâlâ arka plan renkli Text (dolu + iz iki satır için 4 parça değil: %80 -> 2, %10 -> 2).
  expect((await cubuklar(ui)).length).toBe(4)
  await ui.unmount()
})


test('ayrıntı: durum mesaja göre ayrı (aynı görev iki mesajda)', async ($, on) => {
  motor($, on)
  const m = GOREV(['🟢 10 | Ad | Sürüyor | sonnet | gizli not'])
  const u1 = await $.ui.mount(MSGID(m, 'm-1'))
  const u2 = await $.ui.mount(MSGID(m, 'm-2'))
  const d1 = await u1.find({ type: 'Button' })
  await u1.press({ key: d1!.key ?? 't0' })
  expect(await u1.find({ type: 'Text', text: /gizli not/ })).toBeTruthy()
  expect(await u2.find({ type: 'Text', text: /gizli not/ })).toBeFalsy()
  await u1.unmount()
  await u2.unmount()
})
