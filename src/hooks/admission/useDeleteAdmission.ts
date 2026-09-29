import { useState, useCallback } from "react";
import useShowAlerts from "../commons/useShowAlert";
import { formatTrackerError } from "../../utils/errors/trackerErrors";
import { useDataEngine } from "@dhis2/app-runtime";

const DELETE_ADMISSION_MUTATION = {
    resource: "tracker",
    type: 'create',
    data: ({ data }: { data: any }) => data,
    params: {
        async: false,
        importStrategy: "DELETE",
    },
} as any;

const ADMISSION_QUERY = {
    results: {
        resource: "tracker/enrollments",
        id: ({ id }: { id: string }) => id,
        params: {
            fields: "enrollment,trackedEntity,program,status,orgUnit,enrolledAt,occurredAt,followUp,deleted,createdBy,updatedBy",
        },
    },
} as any;

type DeleteAdmissionCallbacks = {
    onComplete?: () => void;
    onError?: (error: unknown) => void;
};

const returnAdmissionBody = (admission: any) => ({
    enrollments: [{
        ...admission,
        deleted: true,
    }]
});

export function useDeleteAdmission() {
    const engine = useDataEngine();
    const { show } = useShowAlerts();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const deleteAdmission = useCallback(
        async (admissionId: string, { onComplete, onError }: DeleteAdmissionCallbacks = {}) => {
            setLoading(true);
            setError(null);

            try {
                const { results } = (await engine.query(ADMISSION_QUERY, {
                    variables: { id: admissionId },
                })) as any;

                if (!results) throw new Error("Admission not found");

                await engine.mutate(DELETE_ADMISSION_MUTATION, {
                    variables: { data: returnAdmissionBody(results) },
                });

                onComplete?.();
            } catch (err) {
                setError(err);
                // Without a handler the failure used to be silent; show the server's reason
                if (onError) onError(err);
                else show({ message: `${"Could not delete the admission"}: ${formatTrackerError(err)}`, type: { critical: true, duration: 15000 } });
            } finally {
                setLoading(false);
            }
        },
        [engine]
    );

    return { deleteAdmission, loading, error };
}
