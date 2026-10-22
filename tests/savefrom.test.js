import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { unwrapSaveFromConverter, normalizeSaveFrom } from '../lib/savefrom.js'

describe('unwrapSaveFromConverter', () => {
  // SaveFrom's converter route answers 403 for visitors, but the `uri`
  // parameter inside it is the plain CDN link for the same file.
  test('unwraps a converter URL to the direct CDN link', () => {
    const result = unwrapSaveFromConverter(
      'https://media.sf-converter.com/get?__sig=abc&__expires=123&uri=https%3A%2F%2Finstagram.fhfa1-1.fna.fbcdn.net%2Fo1%2Fv.mp4&filename=x.mp4'
    )
    assert.equal(result, 'https://instagram.fhfa1-1.fna.fbcdn.net/o1/v.mp4')
  })

  test('leaves a payload URL alone (it holds no direct link)', () => {
    const payload =
      'https://tt.sf-converter.com/get?payload=tlZ9xQEujpfOIw~AVNgtjjfeKXfleR0Vk6Jg2aTbQdYRm8OXX2YJHCgV6h'
    assert.equal(unwrapSaveFromConverter(payload), payload)
  })

  test('leaves a direct CDN URL alone', () => {
    const direct = 'https://video-iad3-1.xx.fbcdn.net/o1/v/t2/f2/m412/a.mp4'
    assert.equal(unwrapSaveFromConverter(direct), direct)
  })

  test('handles empty input', () => {
    assert.equal(unwrapSaveFromConverter(''), '')
    assert.equal(unwrapSaveFromConverter(null), null)
  })
})

describe('normalizeSaveFrom', () => {
  const raw = {
    hosting: 'instagram',
    thumb: 'https://example.com/thumb.jpg',
    meta: { title: 'A title', author: { unique_id: 'someone' } },
    url: [
      { ext: 'mp4', subname: '1080', name: 'HD', url: 'https://cdn.test/1080.mp4' },
      { ext: 'mp4', subname: '720p', name: 'HD', url: 'https://cdn.test/720.mp4' },
      { ext: 'mp3', name: 'Audio', url: 'https://cdn.test/audio.mp3' },
    ],
  }

  test('labels a bare numeric resolution with a p', () => {
    const out = normalizeSaveFrom(raw)
    assert.equal(out.downloads[0].quality, '1080p')
  })

  test('does not turn "HD" into "HDp"', () => {
    const out = normalizeSaveFrom({
      url: [
        { ext: 'mp4', subname: 'HD', url: 'https://cdn.test/hd.mp4' },
        { ext: 'mp4', subname: 'SD', url: 'https://cdn.test/sd.mp4' },
      ],
    })
    const qualities = out.downloads.map((d) => d.quality)
    assert.deepEqual(qualities, ['HD', 'SD'])
  })

  test('drops duplicate quality labels', () => {
    const out = normalizeSaveFrom({
      url: [
        { ext: 'mp4', subname: '720', url: 'https://cdn.test/a.mp4' },
        { ext: 'mp4', subname: '720p', url: 'https://cdn.test/b.mp4' },
      ],
    })
    assert.equal(out.downloads.length, 1)
  })

  test('unwraps converter URLs in the download list', () => {
    const out = normalizeSaveFrom({
      url: [
        {
          ext: 'mp4',
          subname: '1080p',
          url: 'https://media.sf-converter.com/get?__sig=a&uri=https%3A%2F%2Fcdn.test%2Freal.mp4',
        },
      ],
    })
    assert.equal(out.downloads[0].url, 'https://cdn.test/real.mp4')
  })

  test('unwraps the audio URL too', () => {
    const out = normalizeSaveFrom({
      url: [
        {
          ext: 'mp3',
          url: 'https://media.sf-converter.com/get?__sig=a&uri=https%3A%2F%2Fcdn.test%2Fsong.mp3',
        },
      ],
    })
    assert.equal(out.audio.url, 'https://cdn.test/song.mp3')
  })

  test('prefers a direct HD link and puts it first', () => {
    const out = normalizeSaveFrom({
      hd: { url: 'https://cdn.test/hd.mp4' },
      url: [{ ext: 'mp4', subname: '720p', url: 'https://cdn.test/720.mp4' }],
    })
    assert.equal(out.downloads[0].quality, 'HD')
    assert.equal(out.downloads[0].url, 'https://cdn.test/hd.mp4')
  })

  // An image-only post has no mp4 — the caller has to move on to the next
  // upstream instead of handing back an empty list.
  test('throws when there is no video or audio at all', () => {
    assert.throws(
      () => normalizeSaveFrom({ url: [{ ext: 'jpg', url: 'https://cdn.test/a.jpg' }] }),
      /No video or audio stream/
    )
  })

  test('keeps the metadata the UI shows', () => {
    const out = normalizeSaveFrom(raw)
    assert.equal(out.title, 'A title')
    assert.equal(out.author, 'someone')
    assert.equal(out.thumbnail, 'https://example.com/thumb.jpg')
    assert.equal(out.platform, 'instagram')
  })
})
