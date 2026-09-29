// Turns DHIS2 errors into the message the server actually sent. The HTTP status text
// ("Forbidden", "Conflict") says nothing; the reason is in the response body, usually a tracker
// import report whose validationReport.errorReports carry messages like
// "Non-unique attribute value `LIN-001` for attribute `xYz123AbcD`".

interface ProgramLike {
    programTrackedEntityAttributes?: { trackedEntityAttribute?: { id?: string, displayName?: string } }[]
    programStages?: { programStageDataElements?: { dataElement?: { id?: string, displayName?: string } }[] }[]
}

// Attribute and data element names by id, so messages can say "LIN" instead of an id
export function getProgramNames(program?: ProgramLike | null): Record<string, string> {
    const names: Record<string, string> = {}
    for (const x of program?.programTrackedEntityAttributes ?? []) {
        const { id, displayName } = x?.trackedEntityAttribute ?? {}
        if (id && displayName) names[id] = displayName
    }
    for (const stage of program?.programStages ?? []) {
        for (const x of stage?.programStageDataElements ?? []) {
            const { id, displayName } = x?.dataElement ?? {}
            if (id && displayName) names[id] = displayName
        }
    }
    return names
}

// The report is the error's parsed body (app-runtime puts it in `details`) or a 200 response itself
const reportOf = (source: any) => source?.details ?? source?.response ?? source

// Every distinct error message in a tracker import report, or [] when there are none
export function getTrackerErrors(source: unknown, names: Record<string, string> = {}): string[] {
    const report = reportOf(source)
    const reports = [
        ...(report?.validationReport?.errorReports ?? []),
        ...(report?.response?.validationReport?.errorReports ?? []),
    ]
    const messages = reports.map((r: any) => String(r?.message ?? r?.errorCode ?? "")).filter(Boolean)
    const withNames = messages.map((message) =>
        Object.entries(names).reduce((text, [id, name]) => text.split(id).join(name), message))
    return Array.from(new Set(withNames))
}

// One readable line: the report's messages, else the body's message, else the error's own text
export function formatTrackerError(source: unknown, { names = {}, max = 3, fallback = "" }: { names?: Record<string, string>, max?: number, fallback?: string } = {}): string {
    const messages = getTrackerErrors(source, names)
    if (messages.length > 0) {
        const shown = messages.slice(0, max).join("; ")
        return messages.length > max ? `${shown} (and ${messages.length - max} more)` : shown
    }
    const report = reportOf(source)
    return String(report?.message ?? (source as any)?.message ?? fallback)
}
