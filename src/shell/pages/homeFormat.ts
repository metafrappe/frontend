import type { HomeProblem, PendingApproval, RecentChange } from '@/api';
import type { Formatter } from '@/app/locale';

import { t } from '../messages';

const m = t.home;

/** Writes a `YYYY-MM-DD` value with the day name in the user's locale. An unreadable value is returned as is. */
export function formatDay(value: string, format: Formatter): string {
  return format.date(value);
}

/**
 * Writes the server time, e.g. Sunday 22 November 2026 at 09:05 (Turkish UI example).
 * The Frappe value is read in the site's time zone. The time is also written in the site's time zone (IC-13).
 * If the time cannot be read, only the day is written. The shell does not make up a time.
 */
export function formatMoment(value: string, format: Formatter): string {
  const day = formatDay(value, format);
  const instant = format.parseFrappeDatetime(value);
  return instant ? m.moment(day, format.time(instant)) : m.single(day);
}

/** The request's owner and type. Example: "<person name>: <leave type name>" (sample person 3, sample annual leave). */
export function pendingWho(item: PendingApproval): string {
  return m.who(item.employee_name ?? item.name, item.leave_type ?? m.leaveFallback);
}

/** The request's dates, number of days and remaining leave. Missing information is omitted, not made up. */
export function pendingMeta(item: PendingApproval, format: Formatter): string {
  const parts: string[] = [];
  const { from_date: from, to_date: to } = item;
  if (from && to && from !== to)
    parts.push(m.range(formatDay(from, format), formatDay(to, format)));
  else if (from) parts.push(m.single(formatDay(from, format)));
  if (item.total_leave_days !== null) parts.push(m.days(format.number(item.total_leave_days)));
  if (item.leave_balance !== null) parts.push(m.balance(format.number(item.leave_balance)));
  return parts.join(' ');
}

export function problemText(problem: HomeProblem): { tag: string; text: string } {
  if (problem.kind === 'overlap') {
    // The contract provides two requests. The one starting earlier comes first.
    const [a, b] = problem.leaves;
    return {
      tag: m.overlapTag,
      text: m.overlap(problem.department, a?.name ?? '', b?.name ?? ''),
    };
  }
  return {
    tag: m.missingTag,
    text: m.missingJoining(problem.employee_name ?? problem.employee),
  };
}

export function recentText(change: RecentChange): string {
  return m.recent[change.action](change.actor, change.name);
}
