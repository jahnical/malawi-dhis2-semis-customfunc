import { transformQueryParams } from "./tranformParams"
import { TeiQueryProps } from "../../types/api/WithRegistrationTypes"

type MapRule = {
  to: string
  transform?: (value: any) => any
}

export const rules: Record<string, MapRule> = {
  // DHIS2's tracker API expects a semicolon-separated string for multi-id
  // filters like `trackedEntity`. The query engine serializes array-valued
  // params by joining with commas, which the API silently fails to match on
  // (it treats the whole comma-joined blob as one invalid id). Keep the value
  // a plain string here so it reaches the wire with semicolons intact.
  trackedEntities: {
    to: "trackedEntity",
    transform: (v: string | string[]) => Array.isArray(v) ? v.join(";") : v,
  },

  orgUnitMode: {
    to: "ouMode",
  },


  paging: {
    to: "skipPaging",
    transform: (v: boolean) => !v,
  },

  enrollmentStatus: {
    to: "programStatus",
  },
}



export const convertTrackerQueryProps = ({ queryProps, apiVersion }
  : { queryProps: TeiQueryProps, apiVersion: number }) => {
  if (apiVersion < 41)
    return { ...transformQueryParams({ rules, params: queryProps }) as TeiQueryProps }

  return { ...queryProps }
}