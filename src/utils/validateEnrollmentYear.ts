type Calendar = { academicYear: { code?: string; id?: string; label?: string; startDate?: string }; id?: string };

type YearOption = { value?: string; code?: string; label?: string; displayName?: string };

function yearOrder(value: unknown, calendars: Calendar[], options: YearOption[]): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const text = String(value).trim();
    const option = options.find(o => [o.value, o.code, o.label, o.displayName].includes(text));
    const calendar = calendars.find(c => [c.id, c.academicYear?.id, c.academicYear?.code, c.academicYear?.label]
        .some(key => key != null && [text, option?.label, option?.displayName].includes(key)));
    const year = calendar?.academicYear;
    // Compare the starting year without changing stored ranges such as 2025-2026.
    for (const candidate of [text, option?.label, option?.displayName, year?.code, year?.label]) {
        const match = candidate?.trim().match(/^(\d{4})\s*[-/\u2013\u2014]\s*(\d{4})$/);
        if (match && Number(match[2]) === Number(match[1]) + 1) return Number(match[1]);
    }
    // A configured calendar can identify an opaque option code without guessing
    // whether a single numeric code refers to the starting or ending year.
    const start = year?.startDate?.match(/^(\d{4})-(\d{2})-\d{2}(?:T.*)?$/);
    if (start && Number(start[2]) >= 1 && Number(start[2]) <= 12) {
        return Number(start[1]) - (Number(start[2]) < 8 ? 1 : 0);
    }
    return undefined;
}

/** Returns a message when enrollment must be blocked, otherwise undefined. */
export function validateEnrollmentYear({ enrollmentYear, admissionDate, calendars = [], options = [] }: {
    enrollmentYear: unknown;
    admissionDate: unknown;
    calendars?: Calendar[];
    options?: YearOption[];
}): string | undefined {
    const date = typeof admissionDate === 'string' ? admissionDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/) : null;
    const year = date ? Number(date[1]) : 0;
    const month = date ? Number(date[2]) : 0;
    const day = date ? Number(date[3]) : 0;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!date || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        return 'A valid saved admission date is required before enrollment.';
    }
    if (month === 7) return 'The admission date is in July, outside the August–June academic year. Please review the admission record.';
    const admission = month >= 8 ? year : year - 1;
    const enrollment = yearOrder(enrollmentYear, calendars, options);
    if (enrollment === undefined) return 'Select a valid enrollment academic year.';
    if (enrollment < admission) return 'Students cannot be enrolled in an academic year before their admission year.';
}
