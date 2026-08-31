import { describe, expect, it } from 'vitest'
import { createSubmissionGuard } from './submissionGuard'

describe('защита повторной отправки', () => {
  it('выполняет только одну отправку до получения ответа, затем разрешает следующую', async () => {
    const submit = createSubmissionGuard()
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    let sent = 0
    const first = submit(async () => { sent++; await pending })
    await submit(async () => { sent++ })
    expect(sent).toBe(1)
    finish()
    await first
    await submit(async () => { sent++ })
    expect(sent).toBe(2)
  })

  it('после ошибки позволяет повторить отправку', async () => {
    const submit = createSubmissionGuard()
    await expect(submit(async () => { throw new Error('offline') })).rejects.toThrow('offline')
    let retried = false
    await submit(async () => { retried = true })
    expect(retried).toBe(true)
  })
})
