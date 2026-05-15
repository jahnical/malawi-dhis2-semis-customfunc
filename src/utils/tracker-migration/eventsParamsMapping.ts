import { transformQueryParams } from "./tranformParams"
import { EventQueryProps } from "../../types/api/WithoutRegistrationTypes"

type MapRule = {
  to: string
  transform?: (value: any) => any
}

export const rules: Record<string, MapRule> = {
  trackedEntities: {
    to: "trackedEntity",
    transform: (v: string | string[]) => Array.isArray(v) ? v : v.split(";"),
  },

  trackedEntity: {
    to: "trackedEntity",
    transform: (v: string | string[]) => Array.isArray(v) ? v : v.split(";"),
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