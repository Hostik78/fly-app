import { describe, expect, it } from 'vitest'
import { getIcebreakers } from './icebreakers'
import { hobbies } from './hobbies'

describe('getIcebreakers', () => {
  it('returns two non-empty questions for every hobby', () => {
    for (const { id } of hobbies) {
      const questions = getIcebreakers(id)
      expect(questions).toHaveLength(2)
      for (const question of questions) {
        expect(question.length).toBeGreaterThan(0)
      }
    }
  })
})
