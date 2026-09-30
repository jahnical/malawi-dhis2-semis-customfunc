/**
 * Enrollment lifecycle rules for SEMIS (one DHIS2 enrollment per learner per academic year).
 *
 * Pure functions only: no hooks, no API calls. Callers fetch the data and send the payloads.
 *
 * Rules
 *  - ACTIVE     the learner's current (or next, after promotion) academic year
 *  - COMPLETED  a final result that is not a dropout was recorded, or the year is in the past
 *  - CANCELLED  dropout (final result listed in dropoutStatusValues)
 *  - At most one ACTIVE enrollment per learner per program (DHIS2 rule E1015).
 *  - occurredAt (incident date) = start of the academic year from the school calendar.
 *  - enrolledAt = the date the learner was enrolled; defaults to the start of the academic year.
 *  - Later operations never overwrite enrolledAt or occurredAt.
 *
 * Academic years are ordered with yearOrder (validateEnrollmentYear.ts): a range such as "2025/2026"
 * starts in 2025, and a plain code such as "2026" is resolved through its option label or the calendar.
 */
import { yearOrder, type YearOption } from '../validateEnrollmentYear'

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface DataValue { dataElement: string; value?: string | null }

export interface ExistingEvent {
    event?: string
    programStage: string
    orgUnit?: string
    occurredAt?: string
    status?: string
    deleted?: boolean
    dataValues?: DataValue[]
    [key: string]: unknown
}

export interface ExistingEnrollment {
    enrollment: string
    status: EnrollmentStatus | string
    orgUnit: string
    program?: string
    enrolledAt?: string
    occurredAt?: string
    deleted?: boolean
    events?: ExistingEvent[]
}

export interface CalendarEntry {
    id?: string
    academicYear?: { code?: string; id?: string; label?: string; startDate?: string; endDate?: string }
}

/** Where academic year codes are looked up: the school calendar and the academic year option set. */
export interface YearContext {
    calendars?: CalendarEntry[]
    options?: YearOption[]
}

/** First calendar year of an academic year code or label, e.g. "2025/2026" -> 2025. */
export function academicYearOrder(value: unknown, years?: YearContext): number | undefined {
    return yearOrder(value, years?.calendars ?? [], years?.options ?? [])
}

/** Options of the academic year data element, from the program configuration. */
export function getAcademicYearOptions(programConfig: any, academicYearDataElement: string | undefined): YearOption[] {
    if (!academicYearDataElement) return []
    const options = (programConfig?.programStages ?? [])
        .flatMap((stage: any) => stage?.programStageDataElements ?? [])
        .find((item: any) => item?.dataElement?.id === academicYearDataElement)
        ?.dataElement?.optionSet?.options ?? []
    return options.map((option: any) => ({
        value: option?.value ?? option?.code,
        code: option?.code ?? option?.value,
        label: option?.label ?? option?.name ?? option?.displayName,
        displayName: option?.displayName ?? option?.name,
    }))
}

/** Start and end dates of an academic year from semis/schoolCalendar > schoolCalendar[]. */
export function getAcademicYearDates(calendar: CalendarEntry[] | undefined, academicYear: string | undefined, options: YearOption[] = []) {
    if (!calendar || !academicYear) return undefined
    const text = String(academicYear).trim()
    const years = { calendars: calendar, options }
    const order = academicYearOrder(text, years)
    const entry = calendar.find(c => c?.academicYear?.code === text || c?.academicYear?.label === text || c?.academicYear?.id === text)
        ?? (order === undefined ? undefined : calendar.find(c => academicYearOrder(c?.academicYear?.code, years) === order
            || academicYearOrder(c?.academicYear?.label, years) === order))
    const startDate = entry?.academicYear?.startDate
    const endDate = entry?.academicYear?.endDate
    return startDate ? { startDate: startDate.slice(0, 10), endDate: endDate?.slice(0, 10) } : undefined
}

/** Dates for a new enrollment. occurredAt is always the academic year start when the calendar has it. */
export function enrollmentDates({ calendar, academicYear, enrollmentDate, options }: {
    calendar: CalendarEntry[] | undefined, academicYear: string, enrollmentDate?: string, options?: YearOption[]
}) {
    const year = getAcademicYearDates(calendar, academicYear, options)
    const occurredAt = year?.startDate ?? enrollmentDate?.slice(0, 10)
    const enrolledAt = enrollmentDate?.slice(0, 10) ?? year?.startDate
    return { enrolledAt, occurredAt, calendarFound: Boolean(year) }
}

/** Status for a new enrollment: past academic years are created COMPLETED, others ACTIVE. */
export function statusForNewEnrollment(targetAcademicYear: string, currentAcademicYear: string, years?: YearContext): EnrollmentStatus {
    const target = academicYearOrder(targetAcademicYear, years)
    const current = academicYearOrder(currentAcademicYear, years)
    if (target !== undefined && current !== undefined && target < current) return 'COMPLETED'
    return 'ACTIVE'
}

/** Status after a final result is recorded. */
export function statusForFinalResult(finalDecision: string | undefined, dropoutStatusValues: string[] = []): EnrollmentStatus {
    const value = String(finalDecision ?? '').trim().toLowerCase()
    return dropoutStatusValues.some(v => String(v).trim().toLowerCase() === value) && value !== ''
        ? 'CANCELLED'
        : 'COMPLETED'
}

function hasData(event: ExistingEvent) {
    return (event.dataValues ?? []).some(dv => dv.value !== undefined && dv.value !== null && String(dv.value) !== '')
}

/** Academic year recorded on the enrollment's registration event, if any. */
export function academicYearOf(enrollment: ExistingEnrollment, registrationStage: string, academicYearDataElement: string) {
    const registration = (enrollment.events ?? []).find(e => e.programStage === registrationStage && !e.deleted)
    return registration?.dataValues?.find(dv => dv.dataElement === academicYearDataElement)?.value ?? undefined
}

export type TransitionConflict = 'ALREADY_REGISTERED_FOR_YEAR' | 'LATER_YEAR_ALREADY_ACTIVE'

export interface TransitionPlan {
    conflict?: TransitionConflict
    /** ACTIVE admission-only enrollment (no registration event) to fill instead of creating a new one. */
    reuseEnrollment?: ExistingEnrollment
    /** ACTIVE enrollments of earlier years to complete in the same payload. */
    enrollmentsToComplete: ExistingEnrollment[]
    newStatus: EnrollmentStatus
}

/**
 * Decide how to register a learner for `targetAcademicYear` given the learner's existing enrollments
 * in the program. The caller builds one payload containing the completions and the new (or reused) enrollment.
 */
export function planEnrollmentTransition({ existing, targetAcademicYear, currentAcademicYear, registrationStage, academicYearDataElement, years }: {
    existing: ExistingEnrollment[]
    targetAcademicYear: string
    currentAcademicYear: string
    registrationStage: string
    academicYearDataElement: string
    years?: YearContext
}): TransitionPlan {
    const live = existing.filter(e => !e.deleted)
    const target = academicYearOrder(targetAcademicYear, years)
    const newStatus = statusForNewEnrollment(targetAcademicYear, currentAcademicYear, years)
    const yearOf = (e: ExistingEnrollment) => academicYearOrder(academicYearOf(e, registrationStage, academicYearDataElement), years)

    if (target !== undefined && live.some(e => yearOf(e) === target)) {
        return { conflict: 'ALREADY_REGISTERED_FOR_YEAR', enrollmentsToComplete: [], newStatus }
    }

    const active = live.filter(e => e.status === 'ACTIVE')
    const admissionOnly = active.find(e => yearOf(e) === undefined
        && !(e.events ?? []).some(ev => ev.programStage === registrationStage && !ev.deleted))

    if (newStatus === 'COMPLETED') {
        // Back-capture of a past year: leave the current ACTIVE enrollment alone.
        return { enrollmentsToComplete: [], newStatus }
    }

    const enrollmentsToComplete: ExistingEnrollment[] = []
    for (const e of active) {
        if (e === admissionOnly) continue
        const year = yearOf(e)
        if (year !== undefined && target !== undefined && year > target) {
            return { conflict: 'LATER_YEAR_ALREADY_ACTIVE', enrollmentsToComplete: [], newStatus }
        }
        enrollmentsToComplete.push(e)
    }

    return { reuseEnrollment: admissionOnly, enrollmentsToComplete, newStatus }
}

/** Payload entry that closes an enrollment without touching its dates or org unit. */
export function closeEnrollmentPayload(e: ExistingEnrollment, trackedEntity: string, program: string, status: EnrollmentStatus = 'COMPLETED') {
    return {
        enrollment: e.enrollment,
        trackedEntity,
        program: e.program ?? program,
        orgUnit: e.orgUnit,
        status,
        enrolledAt: e.enrolledAt,
        occurredAt: e.occurredAt,
    }
}

/** Fields to send back unchanged when an existing enrollment is updated for another reason. */
export function keepEnrollmentFields(e: Pick<ExistingEnrollment, 'orgUnit' | 'status' | 'enrolledAt' | 'occurredAt'>) {
    return { orgUnit: e.orgUnit, status: e.status, enrolledAt: e.enrolledAt, occurredAt: e.occurredAt }
}

/**
 * Enrollments for one tracked entity after applying a plan: the enrollments to complete first,
 * then the new enrollment (or the reused admission-only one) with the planned status.
 */
export function enrollmentsForTransition<T extends Record<string, unknown>>({ plan, trackedEntity, program, enrollment }: {
    plan: TransitionPlan
    trackedEntity?: string
    program: string
    enrollment: T
}) {
    if (plan.conflict) throw new Error(`Cannot register this enrollment: ${plan.conflict}`)
    return [
        ...plan.enrollmentsToComplete.map(e => closeEnrollmentPayload(e, trackedEntity as string, program)),
        {
            ...enrollment,
            ...(plan.reuseEnrollment ? { enrollment: plan.reuseEnrollment.enrollment } : {}),
            program,
            status: plan.newStatus,
        },
    ]
}

/**
 * Events to send when a transfer is approved (after the ownership transfer call succeeds).
 * - The registration event moves to the receiving school: it records where the learner is placed now.
 * - Events without any data values (placeholders created at enrollment) move too.
 * - Events with data (attendance, marks, socio-economics) stay where they were captured.
 * - The transfer event keeps its org unit (the sending school) and gets the approved status.
 * The enrollment itself is not changed: status, dates and org unit stay as they are.
 */
export function buildTransferApprovalEvents({ events, registrationStage, transferStage, transferEventId, destinationSchool,
    statusDataElement, approvedCode, destinationDataElement }: {
    events: ExistingEvent[]
    registrationStage: string
    transferStage: string
    transferEventId: string
    destinationSchool: string
    statusDataElement: string
    approvedCode: string
    destinationDataElement?: string
}): ExistingEvent[] {
    const live = events.filter(e => !e.deleted)
    const transferEvent = live.find(e => e.event === transferEventId)
    if (!transferEvent) throw new Error(`Transfer event ${transferEventId} not found in the enrollment`)

    const moved = live
        .filter(e => e.event !== transferEventId && e.programStage !== transferStage)
        .filter(e => e.programStage === registrationStage || !hasData(e))
        .map(e => ({ ...e, orgUnit: destinationSchool }))

    const keep = (transferEvent.dataValues ?? [])
        .filter(dv => dv.dataElement !== statusDataElement && dv.dataElement !== destinationDataElement)
    const currentDestination = (transferEvent.dataValues ?? []).find(dv => dv.dataElement === destinationDataElement)?.value
    const approved: ExistingEvent = {
        ...transferEvent,
        dataValues: [
            ...keep,
            { dataElement: statusDataElement, value: approvedCode },
            ...(destinationDataElement ? [{ dataElement: destinationDataElement, value: currentDestination || destinationSchool }] : []),
        ],
    }
    return [...moved, approved]
}
