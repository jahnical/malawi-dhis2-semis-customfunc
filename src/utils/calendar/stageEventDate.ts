// Dates of the term and final-result events, from the school calendar of the enrollment's academic year.
//
// These events used to keep the enrollment date (the placeholders are created when the learner is
// enrolled, and saving marks or a decision kept that date). Analytics that group events by period then
// put all three terms and the year-end result at the start of the year. Now, whenever marks or a final
// result are saved:
//  - performance term stages: the last day of the matching term (1st performance stage = 1st class period)
//  - final result (and any other stage): the last day of the academic year
// never later than today, so a decision recorded during the current year carries the day it was recorded.

export type StageCalendar = {
    academicYear?: { startDate?: string, endDate?: string }
    classPeriods?: { startDate?: string, endDate?: string }[]
} | undefined

const day = (s?: string) => (s ? String(s).slice(0, 10) : undefined)

export function eventDateResolver(calendar: StageCalendar, performanceStages: string[], today: string): (programStage?: string) => string {
    const cap = (d?: string) => (d && d < today ? d : today)
    const terms = [...(calendar?.classPeriods ?? [])].sort((a, b) => String(a?.startDate).localeCompare(String(b?.startDate)))
    const yearEnd = day(calendar?.academicYear?.endDate)
    return (programStage?: string) => {
        const i = programStage ? performanceStages.indexOf(programStage) : -1
        if (i >= 0 && terms[i]?.endDate) return cap(day(terms[i].endDate))
        return cap(yearEnd)
    }
}

/** Date for one stage's event in an academic year: shorthand for eventDateResolver(...)(programStage). */
export function stageEventDate(calendar: StageCalendar, performanceStages: string[], programStage: string | undefined, today: string): string {
    return eventDateResolver(calendar, performanceStages, today)(programStage)
}

/**
 * Date resolver for the events created with an enrollment of `academicYear` (empty term and final-result
 * placeholders that marks and decisions are later written into, on the web or on Android).
 * The year's calendar is looked up by code, label or id; without it every stage gets today.
 */
export function stageDatesForYear(calendars: any[] | undefined | null, academicYear: string | number | null | undefined,
    performanceStages: string[], today: string = localToday()): (programStage?: string) => string {
    const value = academicYear == null ? "" : String(academicYear).trim()
    const calendar = value ? (calendars ?? []).find((c: any) => [c?.academicYear?.code, c?.academicYear?.label, c?.academicYear?.id, c?.id]
        .some(v => v != null && String(v).trim() === value)) : undefined
    return eventDateResolver(calendar, performanceStages, today)
}

function localToday(): string {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
