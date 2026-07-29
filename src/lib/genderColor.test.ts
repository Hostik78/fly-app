import { describe, expect, it } from 'vitest'
import { getGenderColor } from './genderColor'

describe('getGenderColor', () => {
  it('returns a distinct color for female, male, and unspecified', () => {
    const female = getGenderColor('female')
    const male = getGenderColor('male')
    const unspecified = getGenderColor(undefined)

    expect(female).not.toBe(male)
    expect(female).not.toBe(unspecified)
    expect(male).not.toBe(unspecified)
  })

  it('is stable for the same input', () => {
    expect(getGenderColor('female')).toBe(getGenderColor('female'))
  })
})
