interface Translator {
    t: (key: string, options?: any) => string
}

type Need = "required" | "optional" | "none"

interface InfoInstructionsProps {
    i18n: Translator
    // The section's configured filters (dataStore `filters.dataElements`), e.g. Grade/Class or Type of staff/Employment type
    filters?: { label?: string, code?: string, dataElement?: string, order?: number }[]
    // Used to name a filter when it has no configured label
    program?: { programStages?: { programStageDataElements?: { dataElement?: { id?: string, displayName?: string } }[] }[] }
    academicYear?: Need
    // Applies to every section filter, except those listed in requiredFilterCodes
    sectionFilters?: Need
    // Filters the page waits for even when the others are optional (e.g. grade on Performance)
    requiredFilterCodes?: string[]
}

// Landing-page instructions for a module, built from what the page actually needs and the
// section's own filter names, instead of the same student wording everywhere.
export function getInfoInstructions({ i18n, filters = [], program, academicYear = "none", sectionFilters = "none", requiredFilterCodes = [] }: InfoInstructionsProps): string[] {
    const dataElementName = (id?: string) => program?.programStages
        ?.flatMap((stage) => stage?.programStageDataElements ?? [])
        ?.find((x) => x?.dataElement?.id === id)?.dataElement?.displayName

    const namesOf = (list: typeof filters) => [...list]
        .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((f) => f?.label || dataElementName(f?.dataElement) || f?.code)
        .filter(Boolean)
        .join(", ")

    const isForced = (f: typeof filters[0]) => requiredFilterCodes.includes(f?.code ?? "")
    const requiredNames = namesOf(filters.filter((f) => sectionFilters === "required" || isForced(f)))
    const filterNames = namesOf(filters.filter((f) => sectionFilters === "optional" && !isForced(f)))

    const instructions = [i18n.t("Select the Organization unit you want to view data")]

    if (academicYear === "required") instructions.push(i18n.t("Select the academic year"))
    if (requiredNames) instructions.push(i18n.t("Select {{filters}}", { filters: requiredNames }))

    if (sectionFilters === "optional" && filterNames && academicYear === "optional")
        instructions.push(i18n.t("Optionally narrow the list by academic year and {{filters}}", { filters: filterNames }))
    else if (sectionFilters === "optional" && filterNames)
        instructions.push(i18n.t("Optionally narrow the list by {{filters}}", { filters: filterNames }))
    else if (academicYear === "optional")
        instructions.push(i18n.t("Optionally narrow the list by academic year"))

    return instructions
}
