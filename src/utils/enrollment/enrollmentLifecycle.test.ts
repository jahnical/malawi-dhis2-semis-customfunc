import {
    academicYearOrder, getAcademicYearDates, enrollmentDates, statusForNewEnrollment, statusForFinalResult,
    planEnrollmentTransition, closeEnrollmentPayload, buildTransferApprovalEvents, enrollmentsForTransition,
    keepEnrollmentFields, getAcademicYearOptions, ExistingEnrollment,
} from './enrollmentLifecycle'

const REG = 'STGregist01', AY = 'DEacadyear1'
const calendar = [
    { academicYear: { code: '2025/2026', label: '2025/2026', startDate: '2025-09-08', endDate: '2026-07-17' } },
    { academicYear: { code: '2026/2027', label: '2026/2027', startDate: '2026-09-07T00:00:00.000', endDate: '2027-07-16' } },
]
// Plain option codes name the later year of the academic year
const options = [{ code: '2026', label: '2025/2026' }, { code: '2027', label: '2026/2027' }]
const reg = (year: string) => ({ event: `R${year}`, programStage: REG, dataValues: [{ dataElement: AY, value: year }] })
const enr = (id: string, status: string, events: any[] = [], extra: Partial<ExistingEnrollment> = {}): ExistingEnrollment =>
    ({ enrollment: id, status, orgUnit: 'S1', enrolledAt: '2025-09-10', occurredAt: '2025-09-08', events, ...extra })
const plan = (existing: ExistingEnrollment[], target: string, current = '2025/2026') =>
    planEnrollmentTransition({ existing, targetAcademicYear: target, currentAcademicYear: current, registrationStage: REG, academicYearDataElement: AY, years: { calendars: calendar, options } })

test('academic year order', () => {
    expect(academicYearOrder('2025/2026')).toBe(2025)
    expect(academicYearOrder('2026', { options })).toBe(2025)
    expect(academicYearOrder('2026', { calendars: [{ academicYear: { code: '2026', label: '2025/2026' } }] })).toBe(2025)
    expect(academicYearOrder('AY')).toBeUndefined()
})

test('calendar dates and enrollment dates', () => {
    expect(getAcademicYearDates(calendar, '2026/2027')).toEqual({ startDate: '2026-09-07', endDate: '2027-07-16' })
    expect(getAcademicYearDates(calendar, '2027', options)).toEqual({ startDate: '2026-09-07', endDate: '2027-07-16' })
    expect(getAcademicYearDates(calendar, '2030')).toBeUndefined()
    expect(enrollmentDates({ calendar, academicYear: '2026/2027' })).toEqual({ enrolledAt: '2026-09-07', occurredAt: '2026-09-07', calendarFound: true })
    expect(enrollmentDates({ calendar, academicYear: '2026/2027', enrollmentDate: '2026-09-15' })).toEqual({ enrolledAt: '2026-09-15', occurredAt: '2026-09-07', calendarFound: true })
    expect(enrollmentDates({ calendar, academicYear: '2030/2031', enrollmentDate: '2030-09-01' })).toEqual({ enrolledAt: '2030-09-01', occurredAt: '2030-09-01', calendarFound: false })
})

test('status rules', () => {
    expect(statusForNewEnrollment('2024/2025', '2025/2026')).toBe('COMPLETED')
    expect(statusForNewEnrollment('2025/2026', '2025/2026')).toBe('ACTIVE')
    expect(statusForNewEnrollment('2026/2027', '2025/2026')).toBe('ACTIVE')
    expect(statusForNewEnrollment('2026', '2026/2027', { options })).toBe('COMPLETED')
    expect(statusForFinalResult('Dropout', ['Dropout'])).toBe('CANCELLED')
    expect(statusForFinalResult('dropout', ['Dropout'])).toBe('CANCELLED')
    expect(statusForFinalResult('Promoted', ['Dropout'])).toBe('COMPLETED')
    expect(statusForFinalResult('', [''])).toBe('COMPLETED')
})

test('reuses an admission-only enrollment', () => {
    const admission = enr('E0', 'ACTIVE', [])
    const p = plan([admission], '2025/2026')
    expect(p.reuseEnrollment?.enrollment).toBe('E0')
    expect(p.enrollmentsToComplete).toEqual([])
    expect(p.newStatus).toBe('ACTIVE')
})

test('promotion completes a still-active previous year', () => {
    const p = plan([enr('E1', 'ACTIVE', [reg('2025/2026')])], '2026/2027')
    expect(p.conflict).toBeUndefined()
    expect(p.reuseEnrollment).toBeUndefined()
    expect(p.enrollmentsToComplete.map(e => e.enrollment)).toEqual(['E1'])
    expect(p.newStatus).toBe('ACTIVE')
})

test('promotion after final result: nothing to complete', () => {
    const p = plan([enr('E1', 'COMPLETED', [reg('2025/2026')])], '2026/2027')
    expect(p.enrollmentsToComplete).toEqual([])
    expect(p.newStatus).toBe('ACTIVE')
})

test('same year twice is a conflict', () => {
    expect(plan([enr('E1', 'COMPLETED', [reg('2025/2026')])], '2025/2026').conflict).toBe('ALREADY_REGISTERED_FOR_YEAR')
    // The same year written as a plain code ("2026" = 2025/2026)
    expect(plan([enr('E1', 'COMPLETED', [reg('2026')])], '2025/2026').conflict).toBe('ALREADY_REGISTERED_FOR_YEAR')
})

test('back-capture of a past year leaves the active enrollment alone', () => {
    const p = plan([enr('E2', 'ACTIVE', [reg('2025/2026')])], '2023/2024')
    expect(p.newStatus).toBe('COMPLETED')
    expect(p.enrollmentsToComplete).toEqual([])
    expect(p.reuseEnrollment).toBeUndefined()
})

test('a later year already active is a conflict', () => {
    expect(plan([enr('E3', 'ACTIVE', [reg('2026/2027')])], '2025/2026').conflict).toBe('LATER_YEAR_ALREADY_ACTIVE')
})

test('deleted enrollments are ignored', () => {
    const p = plan([enr('E1', 'ACTIVE', [reg('2025/2026')], { deleted: true })], '2025/2026')
    expect(p.conflict).toBeUndefined()
})

test('close payload keeps dates and org unit', () => {
    const e = enr('E1', 'ACTIVE', [reg('2025/2026')], { orgUnit: 'S9', program: 'P1' })
    expect(closeEnrollmentPayload(e, 'T1', 'P0'))
        .toEqual({ enrollment: 'E1', trackedEntity: 'T1', program: 'P1', orgUnit: 'S9', status: 'COMPLETED', enrolledAt: '2025-09-10', occurredAt: '2025-09-08' })
})

test('transfer approval moves only the registration and empty events', () => {
    const events = [
        { event: 'R1', programStage: REG, orgUnit: 'S1', dataValues: [{ dataElement: AY, value: '2025/2026' }] },
        { event: 'A1', programStage: 'ATT', orgUnit: 'S1', dataValues: [{ dataElement: 'status', value: 'present' }] },
        { event: 'T1m', programStage: 'TERM1', orgUnit: 'S1', dataValues: [{ dataElement: 'math', value: '67' }] },
        { event: 'T2m', programStage: 'TERM2', orgUnit: 'S1', dataValues: [] },
        { event: 'FR', programStage: 'FINAL', orgUnit: 'S1', dataValues: [{ dataElement: 'x', value: '' }] },
        { event: 'X', programStage: 'TERM3', orgUnit: 'S1', deleted: true, dataValues: [] },
        { event: 'TR', programStage: 'TRANSFER', orgUnit: 'S1', dataValues: [{ dataElement: 'st', value: 'Pending' }, { dataElement: 'reason', value: 'Other' }] },
    ]
    const out = buildTransferApprovalEvents({ events, registrationStage: REG, transferStage: 'TRANSFER', transferEventId: 'TR',
        destinationSchool: 'S2', statusDataElement: 'st', approvedCode: 'Approved', destinationDataElement: 'dest' })
    const byId = Object.fromEntries(out.map(e => [e.event, e]))
    expect(Object.keys(byId).sort()).toEqual(['FR', 'R1', 'T2m', 'TR'])
    expect(byId.R1.orgUnit).toBe('S2'); expect(byId.T2m.orgUnit).toBe('S2'); expect(byId.FR.orgUnit).toBe('S2')
    expect(byId.TR.orgUnit).toBe('S1')
    expect(byId.TR.dataValues).toEqual([{ dataElement: 'reason', value: 'Other' }, { dataElement: 'st', value: 'Approved' }, { dataElement: 'dest', value: 'S2' }])
    expect('A1' in byId || 'T1m' in byId).toBe(false)
})

test('transfer approval keeps an existing destination', () => {
    const out = buildTransferApprovalEvents({
        events: [{ event: 'TR', programStage: 'TRANSFER', orgUnit: 'S1', dataValues: [{ dataElement: 'dest', value: 'S7' }] }],
        registrationStage: REG, transferStage: 'TRANSFER', transferEventId: 'TR', destinationSchool: 'S2',
        statusDataElement: 'st', approvedCode: 'Approved', destinationDataElement: 'dest' })
    expect(out[0].dataValues).toEqual([{ dataElement: 'st', value: 'Approved' }, { dataElement: 'dest', value: 'S7' }])
})

test('transition payload closes first, then reuses or creates', () => {
    const previous = enr('E1', 'ACTIVE', [reg('2025/2026')], { program: 'P1' })
    const promoted = enrollmentsForTransition({ plan: plan([previous], '2026/2027'), trackedEntity: 'T1', program: 'P1', enrollment: { orgUnit: 'S1', enrolledAt: '2026-09-07', occurredAt: '2026-09-07' } })
    expect(promoted).toEqual([
        { enrollment: 'E1', trackedEntity: 'T1', program: 'P1', orgUnit: 'S1', status: 'COMPLETED', enrolledAt: '2025-09-10', occurredAt: '2025-09-08' },
        { orgUnit: 'S1', enrolledAt: '2026-09-07', occurredAt: '2026-09-07', program: 'P1', status: 'ACTIVE' },
    ])

    const reused = enrollmentsForTransition({ plan: plan([enr('E0', 'ACTIVE')], '2025/2026'), trackedEntity: 'T1', program: 'P1', enrollment: { orgUnit: 'S1' } })
    expect(reused).toEqual([{ orgUnit: 'S1', enrollment: 'E0', program: 'P1', status: 'ACTIVE' }])

    expect(() => enrollmentsForTransition({ plan: plan([previous], '2025/2026'), program: 'P1', enrollment: {} })).toThrow('ALREADY_REGISTERED_FOR_YEAR')
})

test('kept fields and academic year options', () => {
    expect(keepEnrollmentFields(enr('E1', 'CANCELLED'))).toEqual({ orgUnit: 'S1', status: 'CANCELLED', enrolledAt: '2025-09-10', occurredAt: '2025-09-08' })
    const programConfig = { programStages: [{ programStageDataElements: [{ dataElement: { id: AY, optionSet: { options: [{ value: '2026', label: '2025/2026' }] } } }] }] }
    expect(getAcademicYearOptions(programConfig, AY)).toEqual([{ value: '2026', code: '2026', label: '2025/2026', displayName: undefined }])
    expect(getAcademicYearOptions(programConfig, undefined)).toEqual([])
})
