import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { unwrapSddProxy, toPinterestOriginal, SDD_BASE } from '../lib/sdd.js'

describe('unwrapSddProxy', () => {
  // The upstream hands back a path through its own proxy. That route answers
  // HTTP 403 to a visitor, so the direct CDN link has to be extracted.
  test('unwraps a relative proxy path', () => {
    const result = unwrapSddProxy(
      '/api/video?url=https%3A%2F%2Fscontent-fra3-2.cdninstagram.com%2Fo1%2Fvideo.mp4'
    )
    assert.equal(result, 'https://scontent-fra3-2.cdninstagram.com/o1/video.mp4')
  })

  test('unwraps an already-absolute proxy URL', () => {
    const result = unwrapSddProxy(
      `${SDD_BASE}/api/audio?url=https%3A%2F%2Fv1.pinimg.com%2Fvideos%2Fiht%2F720p%2Fa.mp4`
    )
    assert.equal(result, 'https://v1.pinimg.com/videos/iht/720p/a.mp4')
  })

  test('leaves a direct CDN URL alone', () => {
    const direct = 'https://i.pinimg.com/originals/fd/49/15/abc.jpg'
    assert.equal(unwrapSddProxy(direct), direct)
  })

  test('leaves a non-proxy path alone', () => {
    assert.equal(unwrapSddProxy('/api/recent'), '/api/recent')
    assert.equal(unwrapSddProxy('/some/other/path'), '/some/other/path')
  })

  test('keeps a proxy path whose url parameter is not a URL', () => {
    const odd = '/api/video?url=not-a-url'
    assert.equal(unwrapSddProxy(odd), odd)
  })

  test('handles empty input', () => {
    // The helpers hand back the input unchanged when there is nothing to
    // unwrap, so a missing value stays missing instead of becoming a string.
    assert.equal(unwrapSddProxy(''), '')
    assert.equal(unwrapSddProxy(null), null)
    assert.equal(unwrapSddProxy(undefined), undefined)
  })
})

describe('toPinterestOriginal', () => {
  // Pinterest serves a /564x/ preview; /originals/ is the full file
  // (measured 1200x1680 / 136 KB against 564x790 / 65 KB).
  test('upgrades a sized Pinterest image to the original', () => {
    assert.equal(
      toPinterestOriginal('https://i.pinimg.com/564x/fd/49/15/abc.jpg'),
      'https://i.pinimg.com/originals/fd/49/15/abc.jpg'
    )
  })

  test('upgrades any sized variant', () => {
    assert.equal(
      toPinterestOriginal('https://i.pinimg.com/1200x/fd/49/15/abc.jpg'),
      'https://i.pinimg.com/originals/fd/49/15/abc.jpg'
    )
  })

  test('leaves an original alone', () => {
    const original = 'https://i.pinimg.com/originals/fd/49/15/abc.jpg'
    assert.equal(toPinterestOriginal(original), original)
  })

  test('leaves other hosts alone', () => {
    const other = 'https://pbs.twimg.com/media/abc.jpg'
    assert.equal(toPinterestOriginal(other), other)
  })

  test('handles empty input', () => {
    assert.equal(toPinterestOriginal(''), '')
    assert.equal(toPinterestOriginal(null), null)
  })
})
