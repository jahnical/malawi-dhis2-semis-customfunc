/**
 * Extracts the upper (later) year of an academic year value.
 *
 * The academic year is stored as an option code that may be a single year
 * (already the upper number, e.g. "2026") or a range (e.g. "2025/2026",
 * "2025-2026"). In all cases the upper number is the largest 4-digit token.
 *
 * @param academicYear - The academic year code/label (e.g. "2025/2026" or "2026")
 * @returns The upper year as a 4-char string, or null when none can be derived
 */
export function getAcademicYearUpperYear(
    academicYear: string | number | null | undefined
): string | null {
    if (academicYear === null || academicYear === undefined) {
        return null
    }

    const tokens = String(academicYear).match(/\d{4}/g)
    if (!tokens || tokens.length === 0) {
        return null
    }

    return tokens.reduce((max, token) => (Number(token) > Number(max) ? token : max), tokens[0])
}

/**
 * Replaces the first 4 characters of a generated student identifier with the
 * upper (later) year of the academic year the student is being admitted into.
 *
 * Example: academic year "2025/2026" (upper year 2026)
 * → "AB1234XY" becomes "2026234XY" (first 4 chars replaced).
 * When the academic year is provided as a plain code it is already the upper
 * number (e.g. "2026"), so it is used as-is.
 *
 * @param generatedId - The auto-generated identifier string (must be at least 4 chars)
 * @param academicYear - The academic year code/label the student is admitted into
 * @returns The modified identifier, or the original when inputs are invalid
 */
export function applyAcademicYearPrefix(
    generatedId: string,
    academicYear: string | number | null | undefined
): string {
    if (!generatedId || generatedId.length < 4) {
        return generatedId
    }

    const upperYear = getAcademicYearUpperYear(academicYear)
    if (!upperYear) {
        return generatedId
    }

    // Replace first 4 characters with the academic year's upper number
    return upperYear + generatedId.substring(4)
}
