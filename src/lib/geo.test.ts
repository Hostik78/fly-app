import { describe, expect, it } from 'vitest'
import { getDistanceKm } from './geo'

describe('getDistanceKm', () => {
  it('returns 0 for the same point', () => {
    expect(getDistanceKm(55.9736, 37.4125, 55.9736, 37.4125)).toBe(0)
  })

  it('returns roughly the known distance between Moscow and Saint Petersburg (~630-640 km)', () => {
    const distance = getDistanceKm(55.7558, 37.6173, 59.9343, 30.3351)
    expect(distance).toBeGreaterThan(600)
    expect(distance).toBeLessThan(660)
  })

  it('returns a small distance for two nearby points', () => {
    const distance = getDistanceKm(55.9736, 37.4125, 55.9746, 37.4135)
    expect(distance).toBeLessThan(2)
  })
})
