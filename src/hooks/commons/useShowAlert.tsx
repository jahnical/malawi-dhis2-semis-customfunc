import { useAlert } from "@dhis2/app-runtime"
import type { AlertOptions, AlertType } from "../../types/alert/AlertProps"

const useShowAlerts = () => {
  // Callers may pass a longer duration (e.g. for error details that take time to read)
  const { show, hide } = useAlert(({ message }: AlertOptions) => message, ({ type }: AlertType) => ({ duration: 3000, ...type }))

  return { show, hide }
}

export default useShowAlerts
