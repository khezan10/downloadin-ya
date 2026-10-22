import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { normalizePinterestUrl, isPinterestUrl } from '../lib/pinterest.js'

describe('normalizePinterestUrl', () => {
  test('leaves the canonical numeric form alone', () => {
    assert.equal(
      normalizePinterestUrl('https://www.pinterest.com/pin/181199585001797964/'),
      'https://www.pinterest.com/pin/181199585001797964/'
    )
  })

  test('adds the missing trailing slash', () => {
    assert.equal(
      normalizePinterestUrl('https://www.pinterest.com/pin/181199585001797964'),
      'https://www.pinterest.com/pin/181199585001797964/'
    )
  })

  // The upstream's platform matcher only recognises the numeric id, so the
  // slug form has to be rewritten before the request goes out.
  test('strips the slug from a slug--id URL', () => {
    assert.equal(
      normalizePinterestUrl('https://www.pinterest.com/pin/pretty-slug--181199585001797964/'),
      'https://www.pinterest.com/pin/181199585001797964/'
    )
  })

  test('rewrites country domains to pinterest.com', () => {
    for (const host of ['uk.pinterest.com', 'pinterest.co.uk', 'pinterest.de', 'in.pinterest.com']) {
      assert.equal(
        normalizePinterestUrl(`https://${host}/pin/99360735500167749/`),
        'https://www.pinterest.com/pin/99360735500167749/',
        `${host} should normalise`
      )
    }
  })

  test('drops tracking query strings', () => {
    assert.equal(
      normalizePinterestUrl('https://www.pinterest.com/pin/181199585001797964/?invite_code=abc&utm=1'),
      'https://www.pinterest.com/pin/181199585001797964/'
    )
  })

  test('keeps pin.it short links for the upstream to resolve', () => {
    assert.equal(normalizePinterestUrl('https://pin.it/abc123'), 'https://pin.it/abc123')
  })

  test('handles an empty input', () => {
    assert.equal(normalizePinterestUrl(''), '')
  })
})

describe('isPinterestUrl', () => {
  test('matches every Pinterest host', () => {
    assert.equal(isPinterestUrl('https://www.pinterest.com/pin/1/'), true)
    assert.equal(isPinterestUrl('https://pinterest.de/pin/1/'), true)
    assert.equal(isPinterestUrl('https://pin.it/abc'), true)
  })

  test('does not match other platforms', () => {
    assert.equal(isPinterestUrl('https://www.tiktok.com/@u/video/1'), false)
    assert.equal(isPinterestUrl('https://www.instagram.com/p/1/'), false)
  })
})
