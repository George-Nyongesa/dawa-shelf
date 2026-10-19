// Small helpers shared by several screens.

/** A fresh idempotency key. One key = one user intention (one button press). */
export const newKey = (): string => crypto.randomUUID()

/** Whole days from today (local midnight) until an ISO date like 2027-03-31. Negative = already expired. */
export const daysLeft = (iso: string): number => {
  const today = new Date(new Date().toDateString()).getTime()
  return Math.floor((new Date(iso + 'T00:00:00').getTime() - today) / 86_400_000)
}

export const fmtDate = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

/** Colour class for shelf life: r = 30 days or less (or expired), a = 31 to 90, g = fine. */
export const lifeClass = (days: number): 'r' | 'a' | 'g' => (days <= 30 ? 'r' : days <= 90 ? 'a' : 'g')

/** Supabase errors are plain objects, not Error instances, so read .message safely. */
export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Something went wrong'
}
