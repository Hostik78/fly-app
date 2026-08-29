import { describe, expect, it } from 'vitest'
import { getCoverUvScale, getExitMotionStrength, resolveVisualTheme } from './liveWaves'

describe('resolveVisualTheme', () => {
  it('явно выбранная тема важнее системной', () => {
    expect(resolveVisualTheme('light', true)).toBe('light')
    expect(resolveVisualTheme('dark', false)).toBe('dark')
  })

  it('без явного выбора следует теме телефона', () => {
    expect(resolveVisualTheme(undefined, true)).toBe('dark')
    expect(resolveVisualTheme(undefined, false)).toBe('light')
  })
})

describe('getCoverUvScale', () => {
  it('на портретном экране симметрично обрезает широкую картинку по бокам', () => {
    const scale = getCoverUvScale(
      { width: 393, height: 852 },
      { width: 1717, height: 916 },
    )

    expect(scale.x).toBeCloseTo(0.246, 3)
    expect(scale.y).toBe(1)
  })

  it('на очень широком экране симметрично обрезает картинку сверху и снизу', () => {
    const scale = getCoverUvScale(
      { width: 1920, height: 600 },
      { width: 1717, height: 916 },
    )

    expect(scale.x).toBe(1)
    expect(scale.y).toBeLessThan(1)
  })
})

describe('getExitMotionStrength', () => {
  it('до выхода сохраняет полную силу движения', () => {
    expect(getExitMotionStrength(false, 10_000, 650)).toBe(1)
  })

  it('во время выхода плавно замедляется до полной остановки', () => {
    expect(getExitMotionStrength(true, 0, 650)).toBe(1)
    expect(getExitMotionStrength(true, 325, 650)).toBeCloseTo(0.5)
    expect(getExitMotionStrength(true, 650, 650)).toBe(0)
    expect(getExitMotionStrength(true, 1_000, 650)).toBe(0)
  })
})
