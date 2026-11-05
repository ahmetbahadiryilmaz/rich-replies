import { expect, test } from 'claude-code/testing'

const MSG = (text: string, requestId = 'm-t') =>
  ({ plugin: 'rich-replies', component: 'AssistantMessage', surface: 'vscode', requestId, props: { text, isFirstOfReply: true } }) as const

function motor($: any, on: any) {
  on('ui.render', ($: any, e: any) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={`MOTOR:${e.props.text}`} />
  })
}

async function ic(ui: any, text: RegExp) {
  const hepsi = await ui.findAll({ type: 'Text', text })
  return hepsi[hepsi.length - 1]
}

const TABLO = [
  '| Ad | Durum | Not |',
  '|:---|:---:|---:|',
  '| Ali | <span style="color:green">iyi</span> | 1 |',
  '| Veli | <span style="color:red">kötü</span> ve <span style="color:blue">mavi</span> | 22 |',
].join('\n')

// ---- A: renkli tablo ----
test('tablo: spanlı hücreler renkli, sabit genişlikli Box', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(TABLO))
  expect(await ui.find({ type: 'Markdown' })).toBeFalsy()
  expect((await ic(ui, /^iyi$/))?.props?.color).toBe('#22c55e')
  expect((await ic(ui, /^kötü$/))?.props?.color).toBe('#ef4444')
  expect((await ic(ui, /^mavi$/))?.props?.color).toBe('#3b82f6')
  // başlık kalın
  expect((await ic(ui, /^Ad$/))?.props?.bold).toBe(true)
  // sütun 1: en uzun "Veli" (4) + 2 = 6; sütun 2: "kötü ve mavi" (12) + 2 = 14
  const kutular = await ui.findAll({ type: 'Box' })
  const enler = kutular.map((b: any) => b.props?.width).filter((x: any) => typeof x === 'number')
  expect(enler).toContain(6)
  expect(enler).toContain(14)
  expect(await ui.find({ type: 'Text', text: /<span/ })).toBeFalsy()
  await ui.unmount()
})

test('tablo: uzun hücre kırpılır (…), 40 sınırı', async ($, on) => {
  motor($, on)
  const uzun = 'x'.repeat(60)
  const ui = await $.ui.mount(MSG(`| a |\n|---|\n| <span style="color:red">${uzun}</span> |`))
  const t = await ic(ui, /^x+…$/)
  expect(t?.text.length).toBe(40)
  await ui.unmount()
})

test('tablo: sağa hizalı sütun boşlukla itilir', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG(TABLO))
  expect(await ui.find({ type: 'Text', text: /^ {2}$/ })).toBeTruthy()
  await ui.unmount()
})

test('tablo: durum emojisiyle başlayan hücre de ızgara olur', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('| d | x |\n|---|---|\n| 🟢 bitti | 1 |'))
  expect(await ui.find({ type: 'Markdown' })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /🟢 bitti/ })).toBeTruthy()
  await ui.unmount()
})

test('tablo: spansız tablo motora geçer', async ($, on) => {
  motor($, on)
  const m = '| a | b |\n|---|---|\n| 1 | 2 |'
  const ui = await $.ui.mount(MSG(m))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:' + m)
  await ui.unmount()
})

test('karışık mesaj: paragraf + tablo + gorev + sonrası', async ($, on) => {
  motor($, on)
  const m = 'Giriş <span style="color:red">kırmızı</span>\n\n' + TABLO + '\n\nSon paragraf\n\n```gorev\n🟢 100 | İş | Bitti\n```'
  const ui = await $.ui.mount(MSG(m))
  expect((await ic(ui, /kırmızı/))?.props?.color).toBe('#ef4444')
  expect((await ic(ui, /^iyi$/))?.props?.color).toBe('#22c55e')
  expect(await ui.find({ type: 'Markdown', text: /Son paragraf/ })).toBeTruthy()
  const bg = (await ui.findAll({ type: 'Text' })).filter((t: any) => t.props?.backgroundColor)
  expect(bg.length).toBe(1)
  await ui.unmount()
})

test('tablo: kod bloğu içindeki tabloya dokunulmaz', async ($, on) => {
  motor($, on)
  const m = '```\n| a |\n|---|\n| <span style="color:red">x</span> |\n```'
  const ui = await $.ui.mount(MSG(m))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:' + m)
  await ui.unmount()
})

// ---- B: gorev tablo ----
const SATIRLAR = [
  '# Grup A',
  '🟢 100 | Veri modeli | Bitti | sonnet | not A',
  '🟡 50 | Arayüz | Sürüyor | haiku',
  '# Grup B',
  '🔴 - | Hata | Kaldı | sonnet',
]
const bar = async (ui: any) => (await ui.findAll({ type: 'Text' })).filter((t: any) => t.props?.backgroundColor)

for (const [ad, m] of [
  ['bilgi', '```gorev tablo\n' + SATIRLAR.join('\n') + '\n```'],
  ['#! tablo', '```gorev\n#! tablo\n' + SATIRLAR.join('\n') + '\n```'],
] as const) {
  test(`gorev tablo (${ad}): sütunlar, gruplar, renkler, çubuk`, async ($, on) => {
    motor($, on)
    const ui = await $.ui.mount(MSG(m))
    for (const b of ['Durum', 'Görev', 'Durum metni', 'Kim', 'İlerleme']) {
      expect(await ui.find({ type: 'Text', text: new RegExp('^' + b + '$') })).toBeTruthy()
    }
    expect(await ui.find({ type: 'Text', text: /^Grup A$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^Grup B$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /#!/ })).toBeFalsy()
    // görev adı durum renginde
    expect((await ic(ui, /^Veri modeli$/))?.props?.color).toBe('#22c55e')
    expect((await ic(ui, /^Arayüz$/))?.props?.color).toBe('#eab308')
    expect((await ic(ui, /^Hata$/))?.props?.color).toBe('#ef4444')
    // çubuk: 100 -> tek dolu 20; 50 -> 10+10; - -> tek iz 20
    const c = await bar(ui)
    expect(c.length).toBe(1 + 2 + 1)
    expect(c[0].props.backgroundColor).toBe('#15803d')
    expect(c[0].text.length).toBe(20)
    expect(c[1].text.length + c[2].text.length).toBe(20)
    expect(c[3].props.backgroundColor).toBe('#1f2937')
    expect(c[3].text.length).toBe(20)
    expect(await ui.find({ type: 'Text', text: /%100/ })).toBeTruthy()
    // sütun Box genişlikleri: Durum 5+2, İlerleme 25+2
    const enler = (await ui.findAll({ type: 'Box' })).map((b: any) => b.props?.width)
    expect(enler).toContain(7)
    expect(enler).toContain(27)
    await ui.unmount()
  })
}

test('gorev tablo: ▸ düğmesi satır sonunda, tıklayınca ayrıntı açılır', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('```gorev tablo\n' + SATIRLAR.join('\n') + '\n```', 'm-tb'))
  expect((await ui.findAll({ type: 'Button' })).length).toBe(1)
  expect(await ui.find({ type: 'Text', text: /not A/ })).toBeFalsy()
  const d: any = await ui.find({ type: 'Button' })
  expect(String(d?.props?.label ?? d?.text)).toBe('▸')
  await ui.press({ key: d!.key ?? 't0' })
  expect(await ui.find({ type: 'Text', text: /not A/ })).toBeTruthy()
  await ui.press({ key: d!.key ?? 't0' })
  expect(await ui.find({ type: 'Text', text: /not A/ })).toBeFalsy()
  await ui.unmount()
})

test('gorev tablo olmayan blok eski çubuk görünümünde kalır', async ($, on) => {
  motor($, on)
  const ui = await $.ui.mount(MSG('```gorev\n🟡 50 | Yarım | Sürüyor\n```'))
  const c = await bar(ui)
  expect(c.length).toBe(2)
  expect(c[0].text.length + c[1].text.length).toBe(56)
  await ui.unmount()
})
