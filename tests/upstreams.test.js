import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { TIKWM_VARIANTS } from '../lib/tikwm.js'
import { UPSTREAMS, UPSTREAM_BY_ID } from '../lib/upstreams.js'

describe('TikWM client', () => {
  // TikWM answers a serverless caller with an empty body unless the request
  // looks like a browser. The client therefore tries a ladder of header sets.
  test('offers a browser-shaped variant first', () => {
    assert.equal(TIKWM_VARIANTS[0].name, 'browser')
    const headers = TIKWM_VARIANTS[0].headers
    assert.ok(headers.Referer, 'the browser variant must send a Referer')
    assert.ok(headers['Accept-Language'], 'and an Accept-Language')
  })

  test('every variant is a complete header set', () => {
    for (const variant of TIKWM_VARIANTS) {
      assert.ok(variant.name, 'a variant needs a name')
      assert.ok(variant.headers['User-Agent'], `${variant.name} needs a User-Agent`)
      assert.ok(variant.headers.Accept, `${variant.name} needs an Accept`)
    }
  })

  test('the variant names are unique', () => {
    const names = TIKWM_VARIANTS.map((v) => v.name)
    assert.equal(new Set(names).size, names.length)
  })
})

describe('upstream registry', () => {
  test('has unique ids', () => {
    const ids = UPSTREAMS.map((u) => u.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  test('every entry is complete', () => {
    for (const u of UPSTREAMS) {
      assert.ok(u.id, 'id')
      assert.ok(u.label, `${u.id} needs a label`)
      assert.ok(u.host, `${u.id} needs a host`)
      assert.ok(u.role, `${u.id} needs a role`)
      assert.ok(u.scope, `${u.id} needs a scope`)
      assert.ok(u.probeUrl, `${u.id} needs a probe URL`)
      assert.ok(['primary', 'fallback'].includes(u.role), `${u.id} has an unknown role`)
    }
  })

  test('exactly one upstream is the primary', () => {
    const primaries = UPSTREAMS.filter((u) => u.role === 'primary')
    assert.equal(primaries.length, 1)
  })

  test('the registry is indexed by id', () => {
    for (const u of UPSTREAMS) {
      assert.equal(UPSTREAM_BY_ID[u.id], u)
    }
  })

  test('TikWM is probed with a TikTok link, the only thing it resolves', () => {
    assert.ok(UPSTREAM_BY_ID.tikwm.probeUrl.includes('tiktok.com'))
  })
})
