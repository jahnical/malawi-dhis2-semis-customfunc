import { useDataEngine } from "@dhis2/app-runtime";
import { useState } from "react";

const TOTAL_ADMISSIONS_QUERY = {
    results: {
        resource: "tracker/trackedEntities",
        id: ({ id }: any) => id,
        params: {
            fields: "enrollments[enrollment]",
        }
    }
}

export function useGetTotalAdmissions(): any {
    const engine = useDataEngine();
    const [data, setData] = useState<unknown>(null)
    const [loading, setLoading] = useState<boolean>(false)

    async function getTotalAdmission(trackedEntity: string) {
        try {
            setLoading(true)
            const response = await engine.query(TOTAL_ADMISSIONS_QUERY, { variables: { id: trackedEntity } });
            setData(response)
            return response;
        } catch (error) {
            // silent
        } finally {
            setLoading(false)
        }
    }

    return { getTotalAdmission, data, loading }
}
