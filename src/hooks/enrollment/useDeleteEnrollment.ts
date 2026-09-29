import { useState, useCallback } from "react";
import useShowAlerts from "../commons/useShowAlert";
import { formatTrackerError } from "../../utils/errors/trackerErrors";
import { useDataEngine, } from "@dhis2/app-runtime";

const DELETE_ENROLLMENT_MUTATION = {
    resource: "tracker",
    type: 'create',
    data: ({ data }: { data: any }) => data,
    params: {
        async: false,
        importStrategy: "DELETE",
    },
} as any;

const ENROLLMENT_QUERY = {
    results: {
        resource: "tracker/enrollments",
        id: ({ id }: { id: string }) => id,
        params: {
            fields: "enrollment,trackedEntity,program,status,orgUnit,enrolledAt,occurredAt,followUp,deleted,createdBy,updatedBy",
        },
    },
} as any;

type DeleteEnrollmentCallbacks = {
    onComplete?: () => void;
    onError?: (error: unknown) => void;
};

const returnEnrollmentBody = (enrollment: any) => ({
    enrollments: [{
        ...enrollment,
        deleted: true,
    }]
});

export function useDeleteEnrollment() {
    const engine = useDataEngine();
    const { show } = useShowAlerts();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const deleteEnrollment = useCallback(
        async (enrollmentId: string, { onComplete, onError }: DeleteEnrollmentCallbacks = {}) => {
            setLoading(true);
            setError(null);

            try {
                const { results } = (await engine.query(ENROLLMENT_QUERY, {
                    variables: { id: enrollmentId },
                }));

                if (!results) throw new Error("Enrollment not found");

                await engine.mutate(DELETE_ENROLLMENT_MUTATION, {
                    variables: { data: returnEnrollmentBody(results) },
                });

                onComplete?.();
            } catch (err) {
                setError(err);
                // Without a handler the failure used to be silent; show the server's reason
                if (onError) onError(err);
                else show({ message: `${"Could not delete the enrollment"}: ${formatTrackerError(err)}`, type: { critical: true, duration: 15000 } });
            } finally {
                setLoading(false);
            }
        },
        [engine]
    );

    return { deleteEnrollment, loading, error };
}