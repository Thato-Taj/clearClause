/** Mirrors allowanceText / nextCheckText in backend/src/services/util.js — keep in sync. */

const SA_TZ = 'Africa/Johannesburg';
const DAY_MS = 86_400_000;

/** "3 checks every 14 days", "50 checks a day", "unlimited checks". */
export function allowanceText(scans: number, periodDays: number): string {
  if (scans === -1) return 'unlimited checks';
  const noun = scans === 1 ? 'check' : 'checks';
  const period = periodDays === 1 ? 'a day' : periodDays === 7 ? 'a week' : `every ${periodDays} days`;
  return `${scans} ${noun} ${period}`;
}

const saDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: SA_TZ }).format(d);

/** When a check frees up, in South African time: "today at 22:30", "tomorrow at 09:00" or "Tuesday 15 December". */
export function nextCheckText(nextAt: string, now = Date.now()): string {
  const at = new Date(nextAt);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: SA_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  if (saDate(at) === saDate(new Date(now))) return `today at ${time}`;
  if (saDate(at) === saDate(new Date(now + DAY_MS))) return `tomorrow at ${time}`;
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: SA_TZ, ...opts }).format(at);
  return `${part({ weekday: 'long' })} ${part({ day: 'numeric' })} ${part({ month: 'long' })}`;
}
