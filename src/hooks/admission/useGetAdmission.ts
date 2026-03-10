import { useDataEngine } from "@dhis2/app-runtime";
import { useState } from "react";

const ADMISSION_QUERY = {
    results: {
        resource: "tracker/enrollments",
        id: ({ id }: any) => id,
        params: { fields: "*" },
    }
}

export function useGetAdmission(): any {
    const engine = useDataEngine();
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<unknown>(null)
    const [data, setData] = useState<unknown>(null)

    async function getAdmission(admission: string, onComplete?: (data?: unknown) => void, onError?: (error?: unknown) => void) {
        try {
            setLoading(true)
            const response = await engine.query(ADMISSION_QUERY, { variables: { id: admission } });
            if (onComplete) {
                onComplete(response)
            }
            setData(response)
            return response;
        } catch (error) {
            setError(error)
            if (onError) {
                onError(error)
            }
        } finally {
            setLoading(false)
        }
    }
    return { getAdmission, loading, data, error }
}
