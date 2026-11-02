// Performance configuration (semis/values > <section>.performance) applied outside the Performance
// module: which subjects a standard takes, the grade for a score, the term remark, and the same rules as
// spreadsheet formulas for the bulk performance template. Mirrors modules/performance utils
// (subjectsForGrade, gradeFromScore, termRemarks) so the template, the import and the screen agree.

export interface PerformanceMappingConfig {
    subjects?: { scoreDataElement?: string, gradeDataElement?: string, universal?: boolean }[]
    gradeMapping?: { ranges?: { optionCode?: string, minScore?: number, maxScore?: number }[] }
    maxSubjectScore?: number
    termRemarksMapping?: { dataElement?: string, ranges?: { optionCode?: string, minPercentage?: number, maxPercentage?: number }[] }
    standardGroupMapping?: { groups?: { standards?: string[], subjects?: string[] }[] }
}

/**
 * Score and grade data elements that apply to a standard, or null when the configuration does not
 * restrict subjects (no groups, or the standard is in no group): then every subject applies.
 */
export function applicableSubjectDataElements(config: PerformanceMappingConfig | undefined, gradeCode: string | null | undefined): Set<string> | null {
    const groups = config?.standardGroupMapping?.groups
    if (!groups || groups.length === 0 || !gradeCode) return null
    const group = groups.find(g => (g.standards ?? []).includes(gradeCode))
    if (!group) return null
    const subjects = config?.subjects ?? []
    const scores = new Set([...(group.subjects ?? []), ...subjects.filter(s => s.universal === true).map(s => s.scoreDataElement).filter(Boolean) as string[]])
    const allowed = new Set<string>()
    for (const s of subjects) {
        if (s.scoreDataElement && scores.has(s.scoreDataElement)) {
            allowed.add(s.scoreDataElement)
            if (s.gradeDataElement) allowed.add(s.gradeDataElement)
        }
    }
    return allowed
}

/** Every data element the performance configuration fills in or computes (scores, grades, term remark). */
export function configuredSubjectDataElements(config: PerformanceMappingConfig | undefined): Set<string> {
    const ids = new Set<string>()
    for (const s of config?.subjects ?? []) {
        if (s.scoreDataElement) ids.add(s.scoreDataElement)
        if (s.gradeDataElement) ids.add(s.gradeDataElement)
    }
    return ids
}

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || String(value).trim() === "") return null
    const n = Number(String(value).trim())
    return Number.isFinite(n) ? n : null
}

/** Grade option code for a score, or "" when the score is empty or in no range. */
export function gradeForScore(config: PerformanceMappingConfig | undefined, score: unknown): string {
    const n = toNumber(score)
    if (n === null) return ""
    const range = (config?.gradeMapping?.ranges ?? []).find(r => n >= (r.minScore ?? 0) && n <= (r.maxScore ?? 0))
    return range?.optionCode ?? ""
}

/** Term remark option code from the applicable subjects' scores (empty scores count as 0, as on screen). */
export function termRemarkFor(config: PerformanceMappingConfig | undefined, scores: unknown[]): string {
    const ranges = config?.termRemarksMapping?.ranges ?? []
    const max = config?.maxSubjectScore ?? 100
    if (!config?.termRemarksMapping?.dataElement || scores.length === 0 || ranges.length === 0 || max <= 0) return ""
    if (scores.every(s => toNumber(s) === null)) return ""
    const total = scores.reduce<number>((sum, s) => sum + (toNumber(s) ?? 0), 0)
    const pct = (total / (scores.length * max)) * 100
    return ranges.find(r => pct >= (r.minPercentage ?? 0) && pct <= (r.maxPercentage ?? 0))?.optionCode ?? ""
}

const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`
// A cell typed as a number or stored as text ("67") both read as a number
const num = (ref: string) => `VALUE(${ref}&"")`

// The ranges are written side by side, each giving its code or "" and joined with &, instead of one IF
// nested inside the next: deep nesting stops evaluating in some spreadsheet programs once it passes their
// limit, which left the last range (e.g. 80-100) without a grade. Ranges do not overlap, so at most one
// part gives a code, the same result as checking them in order.
const bands = (ranges: { optionCode?: string, min?: number, max?: number }[], value: string) =>
    ranges.map(r => `IF(AND(${value}>=${r.min ?? 0},${value}<=${r.max ?? 0}),${q(r.optionCode ?? "")},"")`).join("&")

/** Spreadsheet formula giving the grade for the score in `scoreRef` (e.g. "H4"). */
export function gradeFormula(config: PerformanceMappingConfig | undefined, scoreRef: string): string {
    const ranges = (config?.gradeMapping?.ranges ?? []).map(r => ({ optionCode: r.optionCode, min: r.minScore, max: r.maxScore }))
    if (ranges.length === 0) return '""'
    return `IF(TRIM(${scoreRef}&"")="","",IFERROR(${bands(ranges, num(scoreRef))},""))`
}

/** Spreadsheet formula giving the term remark from the score cells of the applicable subjects. */
export function termRemarkFormula(config: PerformanceMappingConfig | undefined, scoreRefs: string[]): string {
    const ranges = (config?.termRemarksMapping?.ranges ?? []).map(r => ({ optionCode: r.optionCode, min: r.minPercentage, max: r.maxPercentage }))
    const max = config?.maxSubjectScore ?? 100
    if (scoreRefs.length === 0 || ranges.length === 0 || max <= 0) return '""'
    const filled = scoreRefs.map(r => `(TRIM(${r}&"")<>"")`).join("+")
    const total = scoreRefs.map(r => `IFERROR(${num(r)},0)`).join("+")
    const pct = `((${total})/${scoreRefs.length * max}*100)`
    return `IF((${filled})=0,"",${bands(ranges, pct)})`
}
