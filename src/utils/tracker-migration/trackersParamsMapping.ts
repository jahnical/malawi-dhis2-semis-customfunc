import { TeiQueryProps } from "../../types/api/WithRegistrationTypes"
import { TRACKER_V41, TRACKER_V42, applyPaging, isOrgUnitFreeMode, joinUids, normalizeTrackerParams, withoutUndefined } from "./commonParams"

// Builds /tracker/trackedEntities params for the server's version. Callers may pass UID lists as
// arrays or as ';'/','-joined strings, with either the legacy or the 41+ param names.
export const convertTrackerQueryProps = ({ queryProps, apiVersion }
  : { queryProps: TeiQueryProps, apiVersion: number }): TeiQueryProps => {
  const { rest, orgUnitMode, paging, enrollmentStatus, trackedEntities, orgUnits } = normalizeTrackerParams(queryProps)

  if (apiVersion < TRACKER_V41) {
    return applyPaging(withoutUndefined({
      ...rest,
      ouMode: orgUnitMode,
      programStatus: enrollmentStatus,
      trackedEntity: joinUids(trackedEntities, ";"),
      orgUnit: joinUids(orgUnits, ";"),
    }), paging, apiVersion) as TeiQueryProps
  }

  return applyPaging(withoutUndefined({
    ...rest,
    orgUnitMode,
    [apiVersion < TRACKER_V42 ? "programStatus" : "enrollmentStatus"]: enrollmentStatus,
    trackedEntities: joinUids(trackedEntities, ","),
    orgUnits: isOrgUnitFreeMode(orgUnitMode) ? undefined : joinUids(orgUnits, ","),
  }), paging, apiVersion) as TeiQueryProps
}
