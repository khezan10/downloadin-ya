import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  detectPlatform,
  hostnameOf,
  SUPPORTED_PLATFORMS,
} from '../lib/platform.js'

describe('detectPlatform', () => {
  // Regression: the old implementation matched on a substring of the whole
  // URL, and "t.co" is a substring of "pinterest.com" — so every Pinterest
  // link was classified as Twitter and the Pinterest resolver was never used.
  test('Pinterest is not mistaken for Twitter', () => {
    assert.equal(detectPlatform('https://www.pinterest.com/pin/1234567890/'), 'pinterest')
    assert.equal(detectPlatform('https://pinterest.com/pin/123/'), 'pinterest')
    assert.equal(detectPlatform('https://uk.pinterest.com/pin/123/'), 'pinterest')
    assert.equal(detectPlatform('https://pinterest.co.uk/pin/123/'), 'pinterest')
    assert.equal(detectPlatform('https://pin.it/abc123'), 'pinterest')
  })

  test('recognises every supported platform', () => {
    const cases = [
      ['https://www.tiktok.com/@user/video/1', 'tiktok'],
      ['https://vm.tiktok.com/abc/', 'tiktok'],
      ['https://www.instagram.com/reel/ABC/', 'instagram'],
      ['https://instagr.am/p/ABC/', 'instagram'],
      ['https://www.youtube.com/watch?v=x', 'youtube'],
      ['https://youtu.be/x', 'youtube'],
      ['https://www.threads.net/@u/post/x', 'threads'],
      ['https://www.x.com/u/status/1', 'twitter'],
      ['https://twitter.com/u/status/1', 'twitter'],
      ['https://t.co/abc', 'twitter'],
      ['https://www.facebook.com/reel/1', 'facebook'],
      ['https://fb.watch/abc', 'facebook'],
    ]
    for (const [url, expected] of cases) {
      assert.equal(detectPlatform(url), expected, `${url} should be ${expected}`)
    }
  })

  test('returns unknown for anything else', () => {
    assert.equal(detectPlatform('https://example.com/video'), 'unknown')
    assert.equal(detectPlatform(''), 'unknown')
    assert.equal(detectPlatform('not a url at all'), 'unknown')
    assert.equal(detectPlatform('https://vimeo.com/12345'), 'unknown')
  })

  test('is not fooled by a lookalike hostname', () => {
    assert.equal(detectPlatform('https://notpinterest.com/pin/1/'), 'unknown')
    assert.equal(detectPlatform('https://youtube.com.evil.test/watch?v=1'), 'unknown')
  })
})

describe('hostnameOf', () => {
  test('lowercases and strips the scheme', () => {
    assert.equal(hostnameOf('https://WWW.TikTok.com/x'), 'www.tiktok.com')
  })

  test('accepts a bare host', () => {
    assert.equal(hostnameOf('tiktok.com'), 'tiktok.com')
  })

  test('returns an empty string for junk', () => {
    assert.equal(hostnameOf(''), '')
    assert.equal(hostnameOf(null), '')
  })
})

describe('SUPPORTED_PLATFORMS', () => {
  test('contains exactly the platforms the app advertises', () => {
    assert.deepEqual([...SUPPORTED_PLATFORMS].sort(), [
      'facebook',
      'instagram',
      'pinterest',
      'threads',
      'tiktok',
      'twitter',
      'youtube',
    ])
  })
})
