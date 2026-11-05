import { expect, test } from 'claude-code/testing'

// Üretilen 200x80 test resimleri (düz mavi, "Test" yazılı; kişisel veri yok).
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAABQCAYAAABcbTqwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAALaSURBVHhe7dnPTdxAFMBhmklNFJBCkCiEC01QAA3QAiekSEgcOCAOjjYoLDt+8+whJpox35O+C7GNN5qf/yxnP37+moDYWfkD4EggkBAIJAQCCYFAQiCQEAgkBAIJgUBCIJAQCCQEAgmBQEIgkBAIJAQCCYFAYptArl6mref2Kvg9A7q4e52uL+c/ZwwC+Srv/ycCGZlAtnb5PN2ffBKBjEwgm3qabssPIpChbRPIgvOb13LVTPc3j7PtxieQvRHIpgSyNwLZlED2ZtBAooX4Np96d5m9WJezsMhb3sEenqfzcn+6NVgg9TDKWRXKYhjlVEIRyG6NE0jzYl74HS2L+mSCSFqOJZChDBLI+jtHOfGd5HG6fii3bJhykQtkt4YI5OKu3Psw5ZW8tuhfpovymNGCri3cj9vePc3//UQUcnmejGSAQFoWXRxJeReJzqfc5nNazpUR9B9IdLXPruRrto+2ie40zQSyN90HEj1epftGL/Pl41O0TTHp76gSyN4MGUj7zO8Orcddd74C2ZvOA4nfKdpnHki8mFdM+bi2eEyBjOwbB1I/t8WpRiKQvRkykG2+cZpreeyKz0Ege9N5IPGiXbvvv4rO+33Cu4hA9qb7QKJ9Z99KfbHwHATyLXQfSO0r2fgR5+MdZ3lhHs8r3zY6/ziQ6JEwPzZ96z+QymPWYcpjrNsuusq/TRhd+EfF8ph/RYHUtmUEQwRSu4usmuBxLDqftql/K1aL9Dj1fenPGIEcVK7k+dQfb5YXcm3qxzyIPuvp5PvTl3ECOWi6k6y4UjdHt+KYlces4whkJGMF8q7+HrFuERcWw2s/ZvSZ/0z4ck+v/ksgMCqBQEIgkBAIJAQCCYFAQiCQEAgkBAIJgUBCIJAQCCQEAgmBQEIgkBAIJAQCCYFAQiCQEAgkBAIJgUBCIJAQCCQEAgmBQEIgkBAIJAQCCYFAQiCQEAgkBAIJgUBCIJD4DYiSuBrb7xL6AAAAAElFTkSuQmCC'
const JPG_B64 = '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ABGNq46VyZTl756+IWA5G4uK56km5J7xafMknbf89ToxuJtShS+sc2t3yxSS809NfL8uv1qv7bmiJb3Hh/4n/D7V9DvZVSO4sJbZZ4pI2UZaSKby2VTydu1+O5pvx2+A/wANPiB8GNQ+IHgqxtdImtrFr+2utOt2toLmGPcWRoCFAyA3zbQ2QuSRwce6/bS+Enje0s7nxp8OLi+1WJWTZLYWmoJCNx4SWVkbBGCflHPr1rz749/tkj4geFZPB/gzRpPD/huSNYZZrjYs8sIC4hWNMrEgIIOGbKgD5RkH5nCZTj4Yui8Dhp4eSlefv3p2W9lq3f1fzWq9aWMw7pyWIrRqxtp7vvX/AE/4Z6HYf8E4mAvfHy5G4x2JA79Z6+ef2j/+S7+Of+wrN/Otz9mT4+J8BvF17d3unyajo+pQrBdx27ATR7WyroCQGIyw2kjOeorsf2lPj/8ADX4t+GTH4a8Hz2HiWa9juLjWLywtoJmRUYEGSN2d85UYPHGewr6yGHxmE4kq4pUXKnVjFcytZWUU2/uPHjVoVsr9g5qMoybs+uj0Xrc+a6KKK/QD5sKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z'

const MSG = (text: string, surface: 'vscode' | 'terminal' = 'vscode') =>
  ({ plugin: 'rich-replies', component: 'AssistantMessage', surface, props: { text, isFirstOfReply: true } }) as const

function motor(on: any) {
  on('ui.render', ($: any, e: any) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={`MOTOR:${e.props.text}`} />
  })
}

// Yalnız PNG üstbilgisi + dolgu: verilen en/boy ve bayt sayısında sahte PNG.
function sahtePng(en: number, boy: number, bayt: number): string {
  const b = new Uint8Array(bayt)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  b.set([en >>> 24, (en >>> 16) & 255, (en >>> 8) & 255, en & 255, boy >>> 24, (boy >>> 16) & 255, (boy >>> 8) & 255, boy & 255], 16)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!)
  return btoa(s)
}

const DOSYALAR: Record<string, string> = {
  'C:\\t\\a-test.png': PNG_B64,
  'C:\\t\\b-test.png': PNG_B64,
  'C:\\t\\c-test.jpg': JPG_B64,
  'C:\\t\\genis.png': sahtePng(1000, 100, 2000),
  'C:\\t\\buyuk.png': sahtePng(300, 300, 412 * 1024),
  'C:\\t\\tek.png': PNG_B64,
  'C:\\t\\karisik.png': PNG_B64,
}

// Dosya sistemini taklit eder: tabloda yoksa ENOENT.
function fsTaklit(on: any) {
  const okunan: string[] = []
  on('fs.read', (_$: any, e: any, next: any) => {
    okunan.push(e.path)
    // Motor yolu ters bölüye çevirir (file:/// ve C:/ biçimleri dahil).
    const v = DOSYALAR[e.path.split('/').join('\\')]
    if (v === undefined) return { deny: 'ENOENT: no such file or directory' }
    return { value: { base64: v } }
  })
  return okunan
}

test('yerel PNG satırı Svg olur (data:image/png;base64, en/boy doğru)', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('Önce\n\n![ekran](C:\\t\\a-test.png)\n\nSonra'))
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeTruthy()
  expect(svg?.props?.source).toContain('data:image/png;base64,')
  expect(svg?.props?.source).toContain('width="200" height="80"')
  expect(svg?.props?.width).toBe(200)
  expect(svg?.props?.height).toBe(80)
  expect(svg?.props?.alt).toBe('ekran')
  expect(await ui.find({ type: 'Text', text: /!\[/ })).toBeFalsy()
  await ui.unmount()
})

test('file:/// biçimi de çalışır', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('![x](file:///C:/t/b-test.png)'))
  expect((await ui.find({ type: 'Svg' }))?.props?.source).toContain('data:image/png;base64,')
  await ui.unmount()
})

test('JPEG boyutu SOF işaretçisinden okunur', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('![j](C:\\t\\c-test.jpg)'))
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props?.source).toContain('data:image/jpeg;base64,')
  expect(svg?.props?.width).toBe(200)
  expect(svg?.props?.height).toBe(80)
  await ui.unmount()
})

test('640 sınırı: 1000x100 resim 640x64 çizilir', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('![g](C:\\t\\genis.png)'))
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props?.width).toBe(640)
  expect(svg?.props?.height).toBe(64)
  expect(svg?.props?.source).toContain('viewBox="0 0 640 64"')
  await ui.unmount()
})

test('büyük dosya yer tutucu satıra döner', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('![b](C:\\t\\buyuk.png)'))
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /🖼 buyuk\.png \(büyük: 412 KB\)/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /!\[/ })).toBeFalsy()
  await ui.unmount()
})

test('olmayan dosya (bulunamadı) gösterir', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('![y](C:\\t\\yok.png)'))
  expect(await ui.find({ type: 'Text', text: /🖼 yok\.png \(bulunamadı\)/ })).toBeTruthy()
  await ui.unmount()
})

test('https resmine dokunulmaz, fs çağrılmaz', async ($, on) => {
  motor(on)
  const okunan = fsTaklit(on)
  const m = 'Bak\n\n![a](https://example.com/a.png)'
  const ui = await $.ui.mount(MSG(m))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:' + m)
  expect(okunan.length).toBe(0)
  await ui.unmount()
})

test('kod bloğu içindeki resim satırına dokunulmaz', async ($, on) => {
  motor(on)
  const okunan = fsTaklit(on)
  const m = '```md\n![a](C:\\t\\a-test.png)\n```'
  const ui = await $.ui.mount(MSG(m))
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('MOTOR:' + m)
  expect(okunan.length).toBe(0)
  await ui.unmount()
})

test('aynı dosya aynı mesajda bir kez okunur', async ($, on) => {
  motor(on)
  const okunan = fsTaklit(on)
  const ui = await $.ui.mount(MSG('![a](C:\\t\\tek.png)\n\nara\n\n![b](C:\\t\\tek.png)'))
  expect((await ui.findAll({ type: 'Svg' })).length).toBe(2)
  expect(okunan.filter(p => p === 'C:\\t\\tek.png').length).toBe(1)
  await ui.unmount()
})

test('span + gorev + resim aynı mesajda', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(
    MSG('<span style="color:red">uyarı</span>\n\n```gorev\n🟢 100 | Bitti | ok\n```\n\n![k](C:\\t\\karisik.png)\n\nson'),
  )
  const hepsi = await ui.findAll({ type: 'Text' })
  expect(hepsi.some((t: any) => t.props?.color === '#ef4444')).toBe(true)
  expect(hepsi.some((t: any) => t.props?.backgroundColor === '#15803d')).toBe(true)
  expect(await ui.find({ type: 'Svg' })).toBeTruthy()
  await ui.unmount()
})

test('terminalde PNG Image olur, JPEG yer tutucu', async ($, on) => {
  motor(on)
  fsTaklit(on)
  const ui = await $.ui.mount(MSG('![p](C:\\t\\a-test.png)\n\n![j](C:\\t\\c-test.jpg)', 'terminal'))
  const img = await ui.find({ type: 'Image' })
  expect((img?.props?.source as any)?.png).toBe(PNG_B64)
  expect(await ui.find({ type: 'Text', text: /c-test\.jpg \(terminalde yalnız PNG\)/ })).toBeTruthy()
  await ui.unmount()
})
