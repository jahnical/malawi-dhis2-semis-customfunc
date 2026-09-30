// Shared helpers for translating tracker query params between DHIS2 versions.
//
//  <41 : legacy names (ouMode, skipPaging, programStatus, trackedEntity) and ';'-separated UID lists
//  41  : new names (orgUnitMode, paging, trackedEntities, orgUnits, enrollments), ','-separated lists;
//        the legacy names are deprecated but still accepted
//  42+ : legacy names removed (43 rejects ';' lists with a 400 and silently ignores unknown params),
//        programStatus is replaced by enrollmentStatus (status on /tracker/enrollments)

export const TRACKER_V41 = 41
export const TRACKER_V42 = 42

// Org unit modes that must not be sent with org units (41+ answers 400).
const ORG_UNIT_FREE_MODES = ["ACCESSIBLE", "CAPTURE", "ALL"]

export function toUidList(value: unknown): string[] {
    if (value === undefined || value === null || value === "") return []
    const items = Array.isArray(value) ? value : String(value).split(/[;,]/)
    return Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)))
}

export function joinUids(value: unknown, separator: ";" | ","): string | undefined {
    const uids = toUidList(value)
    return uids.length ? uids.join(separator) : undefined
}

// Takes params written against any version and returns them in the 41+ vocabulary, so callers
// can keep using whichever names they were written with.
export function normalizeTrackerParams(params: Record<string, any>) {
    const { orgUnitMode, ouMode, paging, skipPaging, enrollmentStatus, programStatus, trackedEntity, trackedEntities,
        orgUnit, orgUnits, ou, enrollment, enrollments, ...rest } = params

    return {
        rest: rest as Record<string, any>,
        orgUnitMode: (orgUnitMode ?? ouMode) as string | undefined,
        paging: (paging ?? (skipPaging !== undefined ? !skipPaging : undefined)) as boolean | undefined,
        enrollmentStatus: (enrollmentStatus ?? programStatus) as string | undefined,
        trackedEntities: toUidList(trackedEntities ?? trackedEntity),
        orgUnits: toUidList(orgUnits ?? orgUnit ?? ou),
        enrollments: toUidList(enrollments ?? enrollment),
    }
}

export function isOrgUnitFreeMode(orgUnitMode?: string) {
    return !!orgUnitMode && ORG_UNIT_FREE_MODES.includes(orgUnitMode.toUpperCase())
}

// 41+ rejects paging=false together with page/pageSize/totalPages.
export function applyPaging(params: Record<string, any>, paging: boolean | undefined, apiVersion: number) {
    if (paging === undefined) return params

    if (apiVersion < TRACKER_V41) return { ...params, skipPaging: !paging }

    if (paging === false) {
        const { page, pageSize, totalPages, ...unpaged } = params
        return { ...unpaged, paging: false }
    }
    return { ...params, paging: true }
}

export function withoutUndefined<T extends Record<string, any>>(params: T): T {
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as T
}
