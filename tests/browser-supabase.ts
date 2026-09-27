// Только изолированный браузерный стенд. Эта подмена не входит в production.
let actor = 0
const listeners = new Set<() => void>()
export function selectFixtureActor(next: number) {
  actor = next
  listeners.forEach((fn) => fn())
}
export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: actor < 0 ? null : { access_token: `fixture-${actor}` } },
    }),
    onAuthStateChange: (fn: () => void) => {
      listeners.add(fn)
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }
    },
  },
  rpc: async (name: string, args?: unknown) => {
    const response = await fetch('/fixture/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, args, actor }),
    })
    return response.json()
  },
}
