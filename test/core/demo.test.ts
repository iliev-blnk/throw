import { describe, expect, it } from 'vitest'
import { parseShow } from '../../src/core/show'
import { demoShow } from '../../src/ui/demo'

describe('demo show', () => {
  it('demo/demo-show.json is the demo show (regenerate with vitest -u)', async () => {
    await expect(`${JSON.stringify(demoShow(), null, 2)}\n`).toMatchFileSnapshot('../../demo/demo-show.json')
  })

  it('imports cleanly', () => {
    const r = parseShow(demoShow())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.show.looks.filter(Boolean).length).toBe(6)
  })
})
