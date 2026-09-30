import { EventQueryProps } from "../../types/api/WithoutRegistrationTypes"
import { TRACKER_V41, TRACKER_V42, applyPaging, isOrgUnitFreeMode, joinUids, normalizeTrackerParams, withoutUndefined } from "./commonParams"

// Builds /tracker/events params for the server's version.
//
// Unlike /tracker/trackedEntities, /tracker/events only takes a SINGLE `trackedEntity` on every
// version (40 answers E1003 to a joined list, 41+ silently ignores `trackedEntities` and returns
// unfiltered events). A query for several tracked entities is therefore split into one query per
// tracked entity; callers that need many should filter by `enrollments` instead, which is a real
// list filter on all versions.
export const convertEventQueryProps = ({ queryProps, apiVersion }
  : { queryProps: EventQueryProps, apiVersion: number }): EventQueryProps[] => {
  const { rest, orgUnitMode, paging, enrollmentStatus, trackedEntities, orgUnits, enrollments } = normalizeTrackerParams(queryProps)
  const legacy = apiVersion < TRACKER_V41

  const base = applyPaging(withoutUndefined({
    ...rest,
    [legacy ? "ouMode" : "orgUnitMode"]: orgUnitMode,
    [apiVersion < TRACKER_V42 ? "programStatus" : "enrollmentStatus"]: enrollmentStatus,
    // /tracker/events takes a single `orgUnit` on every version
    orgUnit: !legacy && isOrgUnitFreeMode(orgUnitMode) ? undefined : orgUnits[0],
    enrollments: joinUids(enrollments, ","),
  }), paging, apiVersion) as EventQueryProps

  if (trackedEntities.length === 0) return [base]
  return trackedEntities.map((trackedEntity) => ({ ...base, trackedEntity }))
}

// Merges the responses of split queries back into a single response.
export const mergeEventResponses = (responses: any[]): any => {
  if (responses.length === 1) return responses[0]

  const events = responses.flatMap((response) => response?.results?.instances ?? response?.results?.events ?? [])
  return { results: { events, pager: { page: 1, pageSize: events.length, pageCount: 1, total: events.length } } }
}
