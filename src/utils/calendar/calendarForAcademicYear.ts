/**
 * The school calendar entry (semis/schoolCalendar > schoolCalendar[]) for an academic year.
 *
 * Attendance used the entry of `defaults.academicYear` (the current year) for every year, so for a past
 * year such as 2018-2019 every date fell outside that calendar's term dates and was shown as a
 * non-school day. The academic year selected in the header is matched by code, label or id; the
 * current year's entry is used only when no year is selected or the year is not in the calendar.
 */
export interface CalendarEntryLike {
    id?: string
    academicYear?: { code?: string, label?: string, id?: string, startDate?: string, endDate?: string }
    [key: string]: unknown
}

export function calendarForAcademicYear<T extends CalendarEntryLike>(
    calendars: T[] | undefined | null,
    academicYear: string | null | undefined,
    defaultAcademicYear?: string | null,
): T | undefined {
    const list = calendars ?? []
    const find = (year: string | null | undefined) => {
        const value = String(year ?? "").trim()
        if (!value) return undefined
        return list.find(c => [c?.academicYear?.code, c?.academicYear?.label, c?.academicYear?.id, c?.id]
            .some(v => v != null && String(v).trim() === value))
    }
    return find(academicYear) ?? find(defaultAcademicYear)
}

/** `date` if it falls inside the calendar's academic year, otherwise the nearest end of that year. */
export function clampToAcademicYear(date: Date, calendar?: CalendarEntryLike): Date {
    const start = calendar?.academicYear?.startDate, end = calendar?.academicYear?.endDate
    const day = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d) }
    if (end && date > day(end)) return day(end)
    if (start && date < day(start)) return day(start)
    return date
}
