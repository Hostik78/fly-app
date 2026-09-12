import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEVICE_ID,
  DEVICE_PRESETS,
  calculateFitScale,
  buildDevicePreviewUrl,
  getDevicePreviewMode,
  getDevicePreset,
} from './devicePreview'

describe('предпросмотр на разных смартфонах', () => {
  it('содержит компактный iPhone, современный iPhone и Android с разными вырезами', () => {
    expect(DEVICE_PRESETS.map((device) => device.id)).toEqual(expect.arrayContaining([
      'iphone-se',
      'iphone-15-pro',
      'galaxy-s23',
    ]))

    expect(getDevicePreset('iphone-se').cutout).toBe('none')
    expect(getDevicePreset('iphone-15-pro').cutout).toBe('dynamic-island')
    expect(getDevicePreset('galaxy-s23').cutout).toBe('punch-hole')
  })

  it('возвращается к устройству по умолчанию при неизвестном сохранённом id', () => {
    expect(getDevicePreset('old-device').id).toBe(DEFAULT_DEVICE_ID)
  })

  it('уменьшает большой телефон, чтобы он целиком помещался в невысокое окно', () => {
    const scale = calculateFitScale({
      viewportWidth: 1200,
      viewportHeight: 720,
      device: getDevicePreset('iphone-15-pro-max'),
    })

    expect(scale).toBeLessThan(1)
    expect((932 + 24) * scale).toBeLessThanOrEqual(720 - 72 - 32)
  })

  it('не растягивает экран телефона больше его настоящего CSS-размера', () => {
    const scale = calculateFitScale({
      viewportWidth: 2400,
      viewportHeight: 1600,
      device: getDevicePreset('iphone-se'),
    })

    expect(scale).toBe(1)
  })

  it('включает студию только на компьютере, а на настоящем телефоне оставляет обычное приложение', () => {
    expect(getDevicePreviewMode({ isDev: true, search: '', hasFinePointer: true })).toEqual({ type: 'host' })
    expect(getDevicePreviewMode({ isDev: true, search: '', hasFinePointer: false })).toEqual({ type: 'off' })
    expect(getDevicePreviewMode({ isDev: false, search: '', hasFinePointer: true })).toEqual({ type: 'off' })
  })

  it('отличает внутренний viewport от внешней студии и не создаёт рекурсию', () => {
    expect(getDevicePreviewMode({
      isDev: true,
      search: '?device-preview=galaxy-s23',
      hasFinePointer: true,
    })).toEqual({ type: 'frame', deviceId: 'galaxy-s23' })
  })

  it('строит отдельный адрес приложения с выбранным viewport и сохраняет остальные параметры', () => {
    expect(buildDevicePreviewUrl('http://localhost:4188/?splash=dark#/messages', getDevicePreset('iphone-se')))
      .toBe('/?splash=dark&device-preview=iphone-se&preview-safe-top=20&preview-safe-right=0&preview-safe-bottom=0&preview-safe-left=0#/messages')
  })
})
