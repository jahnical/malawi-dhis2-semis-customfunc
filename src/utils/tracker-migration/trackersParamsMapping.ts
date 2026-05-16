import { transformQueryParams } from "./tranformParams"
import { TeiQueryProps } from "../../types/api/WithRegistrationTypes"

type MapRule = {
  to: string
  transform?: (value: any) => any
}

export const rules: Record<string, MapRule> = {
  trackedEntities: {
    to: "trackedEntity",
    transform: (v: string | string[]) => Array.isArray(v) ? v : v.split(";"),
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