type Calendar = { academicYear: { code?: string; id?: string; label?: string }; id?: string };
type YearOption = { value?: string; code?: string; label?: string; displayName?: string };

function rangeStart(value: unknown): number | undefined {
    const match = String(value ?? '').trim().match(/^(\d{4})\s*[-/\u2013\u2014]\s*(\d{4})$/);
    return match && Number(match[2]) === Number(match[1]) + 1 ? Number(match[1]) : undefined;
}

function yearOrder(value: unknown, calendars: Calendar[], options: YearOption[]): number | undefined {
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
    return rangeStart(calendar?.academicYear?.label);
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
