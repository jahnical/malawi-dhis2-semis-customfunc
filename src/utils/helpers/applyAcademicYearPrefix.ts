/**
 * Replaces the first 4 characters of a generated student identifier with the
 * upper (end) year of the academic calendar that the admission date falls in.
 *
 * Example: admission date 2025-09-01 in a calendar running Aug 2025 – Jul 2026
 * → upper year is 2026 → "AB1234XY" becomes "2026234XY" (first 4 chars replaced).
 *
 * @param generatedId - The auto-generated identifier string (must be at least 4 chars)
 * @param admissionDate - ISO date string (e.g. "2025-09-01")
 * @param schoolCalendars - Array of calendar entries, each with academicYear.startDate / endDate
 * @returns The modified identifier, or the original if no matching calendar is found
 */
export function applyAcademicYearPrefix(
    generatedId: string,
    admissionDate: string,
    schoolCalendars: Array<{
        academicYear: {
            startDate: string
            endDate: string
        }
    }>
): string {
    if (!generatedId || generatedId.length < 4 || !admissionDate || !schoolCalendars?.length) {
        return generatedId
    }

    const admDate = new Date(admissionDate)
    if (isNaN(admDate.getTime())) {
        return generatedId
    }

    // Find the academic calendar whose range contains the admission date
    const matchingCalendar = schoolCalendars.find((cal) => {
        if (!cal?.academicYear?.startDate || !cal?.academicYear?.endDate) return false
        const start = new Date(cal.academicYear.startDate)
        const end = new Date(cal.academicYear.endDate)
        return admDate >= start && admDate <= end
    })

    if (!matchingCalendar) {
        return generatedId
    }

    const endDate = new Date(matchingCalendar.academicYear.endDate)
    const upperYear = endDate.getFullYear().toString()

    // Replace first 4 characters with the upper year
    return upperYear + generatedId.substring(4)
}
