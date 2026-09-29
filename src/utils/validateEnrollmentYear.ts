type Calendar = { academicYear: { code?: string; id?: string; label?: string; startDate?: string }; id?: string };

function yearOrder(value: unknown, calendars: Calendar[]): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const text = String(value).trim();
    const calendar = calendars.find(c => [c.id, c.academicYear.id, c.academicYear.code, c.academicYear.label].includes(text));
    const year = calendar?.academicYear;
    // Compare the starting year without changing stored ranges such as 2025-2026.
    const match = String(year?.startDate || year?.code || text).match(/^(\d{4})(?:\D|$)/);
    return match ? Number(match[1]) : undefined;
}

/** Returns a message when enrollment must be blocked, otherwise undefined. */
export function validateEnrollmentYear({ enrollmentYear, admissionYear, calendars = [] }: {
    enrollmentYear: unknown;
    admissionYear: unknown;
    calendars?: Calendar[];
}): string | undefined {
    const admission = yearOrder(admissionYear, calendars);
    const enrollment = yearOrder(enrollmentYear, calendars);
    if (admission === undefined) return 'Record a valid admission academic year before enrolling this student.';
    if (enrollment === undefined) return 'Select a valid enrollment academic year.';
    if (enrollment < admission) return 'Students cannot be enrolled in an academic year before their admission year.';
}
