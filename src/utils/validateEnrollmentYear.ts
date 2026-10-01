export type Calendar = { academicYear?: { code?: string; id?: string; label?: string }; id?: string };
export type YearOption = { value?: string; code?: string; label?: string; displayName?: string };

// A range anywhere in the text: "2025/2026", "2025-26", "Academic Year 2025/2026". The end must be the
// year after the start; a two-digit end ("26") belongs to the start's century.
function rangeStart(value: unknown): number | undefined {
    const match = String(value ?? '').trim().match(/(?:^|\D)(\d{4})\s*[-/\u2013\u2014]\s*(\d{4}|\d{2})(?!\d)/);
    if (!match) return undefined;
    const start = Number(match[1]);
    const end = match[2].length === 2 ? (start + 1) - ((start + 1) % 100) + Number(match[2]) : Number(match[2]);
    return end === start + 1 ? start : undefined;
}

// A single year such as "2026" names the later year of the academic year (2025/2026), the same
// convention as the identifier prefix and the admission year filters.
function singleYearStart(value: unknown): number | undefined {
    const match = String(value ?? '').trim().match(/^(\d{4})$/);
    return match ? Number(match[1]) - 1 : undefined;
}

/**
 * First calendar year of an academic year, e.g. 2025 for 2025/2026.
 * A plain code such as "2026" names the later year, so it is resolved through its option label or the calendar.
 */
export function yearOrder(value: unknown, calendars: Calendar[] = [], options: YearOption[] = []): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const text = String(value).trim();
    const option = options.find(o => [o.value, o.code, o.label, o.displayName]
        .some(key => key != null && String(key) === text));
    // Each field can use different codes for the same academic year.
    // Prefer its own option label before consulting the shared calendar.
    for (const candidate of [option?.label, option?.displayName, text]) {
        const start = rangeStart(candidate);
        if (start !== undefined) return start;
    }
    const calendar = calendars.find(c => [c.id, c.academicYear?.id, c.academicYear?.code, c.academicYear?.label]
        .some(key => key != null && String(key) === text));
    const fromCalendar = rangeStart(calendar?.academicYear?.label);
    if (fromCalendar !== undefined) return fromCalendar;
    // No range anywhere: fall back to a single-year code or label
    for (const candidate of [option?.label, option?.displayName, calendar?.academicYear?.label, text]) {
        const start = singleYearStart(candidate);
        if (start !== undefined) return start;
    }
    return undefined;
}

/** Compare academic years only; never derive the admission year from a date. */
export function validateEnrollmentYear({ enrollmentYear, admissionYear, calendars = [], options = [], admissionOptions = [] }: {
    enrollmentYear: unknown;
    admissionYear: unknown;
    calendars?: Calendar[];
    options?: YearOption[];
    admissionOptions?: YearOption[];
}): string | undefined {
    const admission = yearOrder(admissionYear, calendars, admissionOptions);
    if (admission === undefined) return 'A valid saved admission academic year is required before enrollment.';
    const enrollment = yearOrder(enrollmentYear, calendars, options);
    if (enrollment === undefined) return 'Select a valid enrollment academic year.';
    if (enrollment < admission) return 'Students cannot be enrolled in an academic year before their admission year.';
}
