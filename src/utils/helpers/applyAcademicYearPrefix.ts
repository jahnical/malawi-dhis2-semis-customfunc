/**
 * Replaces the first 4 characters of a generated student identifier with the
 * next year derived from the admission date.
 *
 * Example: admission date 2025-09-01
 * → next year is 2026 → "AB1234XY" becomes "2026234XY" (first 4 chars replaced).
 *
 * @param generatedId - The auto-generated identifier string (must be at least 4 chars)
 * @param admissionDate - ISO date string (e.g. "2025-09-01")
 * @returns The modified identifier, or the original when inputs are invalid
 */
export function applyAcademicYearPrefix(
    generatedId: string,
    admissionDate: string
): string {
    if (!generatedId || generatedId.length < 4 || !admissionDate) {
        return generatedId
    }

    const admDate = new Date(admissionDate)
    if (isNaN(admDate.getTime())) {
        return generatedId
    }

    const nextYear = (admDate.getFullYear() + 1).toString()

    // Replace first 4 characters with next year from admission date
    return nextYear + generatedId.substring(4)
}
