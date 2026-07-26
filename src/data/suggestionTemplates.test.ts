import { describe, expect, it } from 'vitest'
import { getSuggestions } from './suggestionTemplates'
import { categories } from './categories'
import type { LiveContext } from '../lib/liveContext'

describe('getSuggestions', () => {
  const withWeather: LiveContext = { timeOfDay: 'вечер', weather: 'дождь', temperature: 8 }
  const withoutWeather: LiveContext = { timeOfDay: 'утро', weather: null, temperature: null }

  it('returns two non-empty suggestions for every category', () => {
    for (const { id } of categories) {
      const suggestions = getSuggestions(id, withWeather)
      expect(suggestions).toHaveLength(2)
      for (const text of suggestions) {
        expect(text.length).toBeGreaterThan(0)
      }
    }
  })

  it('mentions the weather and time of day when weather is known', () => {
    const suggestions = getSuggestions('communication', withWeather)
    expect(suggestions.join(' ')).toContain('дождь')
    expect(suggestions.join(' ')).toContain('вечер')
  })

  it('falls back to a weather-free phrasing when weather is unknown', () => {
    const suggestions = getSuggestions('communication', withoutWeather)
    expect(suggestions.join(' ')).not.toContain('null')
    expect(suggestions.join(' ')).toContain('утро')
  })
})
