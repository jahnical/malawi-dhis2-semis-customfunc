import { transformQueryParams } from "./tranformParams"
import { EventQueryProps } from "../../types/api/WithoutRegistrationTypes"

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

  trackedEntity: {
    to: "trackedEntity",
    transform: (v: string | string[]) => Array.isArray(v) ? v.join(";") : v,
  },

  // events: {
  //     to: "event",
  //     transform: (v: string) => v.replaceAll(",", ";"),
  // },

  orgUnitMode: {
    to: "ouMode",
  },

  // orgUnits: {
  //     to: "ou",
  //     transform: (v: string) => v.replaceAll(",", ";"),
  // },

  // enrollments: {
  //     to: "enrollment",
  //     transform: (v: string) => v.replaceAll(",", ";"),
  // },

  paging: {
    to: "skipPaging",
    transform: (v: boolean) => !v,
  },

  enrollmentStatus: {
    to: "programStatus",
  },
}


export const convertEventQueryProps = ({ queryProps, apiVersion }
  : { queryProps: EventQueryProps, apiVersion: number }): EventQueryProps => {
  if (apiVersion < 41)
    return { ...transformQueryParams({ rules, params: queryProps }) as EventQueryProps }

  return { ...queryProps }
}