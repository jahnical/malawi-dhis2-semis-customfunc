import { attributesProps } from "../../../types/api/WithRegistrationTypes";
import { dataValuesProps } from "../../../types/api/WithoutRegistrationTypes";
import { attendanceConfig, AttendanceFormaterProps } from "src/types/table/FormatRowsDataTypes";
import { FormatResponseRowsProps, RowsDataProps } from "../../../types/common/FormatRowsDataProps";

export function formatRowsData({ registrationInstances, teiInstances, isBasicStage = false }: FormatResponseRowsProps): RowsDataProps[] {
    const allRows: RowsDataProps[] = [];

    for (const event of registrationInstances ?? []) {
        const teiDetails = teiInstances?.find(tei => tei.trackedEntity === event.trackedEntity);

        // Find the enrollment that matches the current academic year event's 
        const currentEnrollment = teiDetails?.enrollments?.find(enrollment => enrollment.enrollment === event.enrollment);

        // Check if the TEI has any active enrollment
        const hasActiveEnrollment = teiDetails?.enrollments?.some(enrollment => enrollment.status === 'ACTIVE') ?? false;

        allRows.push({
            ...dataValues(event.dataValues),
            ...(attributes((teiDetails?.attributes) ?? [])),
            // If isBasicStage is false, the function is being called by `getStageData`, 
            // so the event ID needed comes from the other stage. 
            // To avoid overwriting data, a second key is required.
            ...(isBasicStage ?
                {
                    registrationEvent: event?.event,
                    registrationEventOccurredAt: event?.occurredAt,
                    enrollmentId: event?.enrollment,
                    trackedEntity: event.trackedEntity,
                    orgUnitId: currentEnrollment?.orgUnit,
                    programId: currentEnrollment?.program,
                    status: currentEnrollment?.status,
                    hasActiveEnrollment: hasActiveEnrollment ? 'Yes' : 'No',
                    ownershipOu: teiDetails?.programOwners?.[teiDetails?.programOwners.length - 1]?.orgUnit ??
                        teiDetails?.programOwners?.[0]?.orgUnit,
                } : {
                    programStageEvent: event?.event
                })
        });
    }
    return allRows;
}

export function dataValues(data: dataValuesProps[]): RowsDataProps {
    const localData: RowsDataProps = {};
    for (const dataElement of data) {
        localData[dataElement.dataElement] = dataElement.value;
    }
    return localData;
}

export function attributes(data: attributesProps[]): RowsDataProps {
    const localData: RowsDataProps = {};
    for (const attribute of data) {
        localData[attribute.attribute] = attribute.value;
    }
    return localData;
}

/**
 * TEI-first row formatter for the Admission module.
 * Iterates over TEIs (not events), attaching registration event data when available.
 * This ensures TEIs without registration events still appear in the table.
 */
export function formatAdmissionRowsData({ teiInstances, registrationInstances, academicYear, enrollmentStatusAcademicYear, academicYearDataElement }: FormatResponseRowsProps): RowsDataProps[] {
    const allRows: RowsDataProps[] = [];

    for (const tei of teiInstances ?? []) {
        // Find the most recent registration event for this TEI
        const teiEvents = (registrationInstances ?? [])
            .filter((event: any) => event.trackedEntity === tei.trackedEntity)
            .sort((a: any, b: any) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime());
        const mostRecentEvent = teiEvents[0];
        const activeEnrollment = tei.enrollments?.find((e: any) => e.status === 'ACTIVE');
        const eventForDisplayedValues = mostRecentEvent;

        // Determine enrollment status by checking for an ACTIVE enrollment
        // in the current/default academic year.
        // Registration events store the academic year as a data element value.
        // We match events for the status year, then check if their enrollment is ACTIVE.
        let isEnrolled = false;
        const statusAcademicYear = enrollmentStatusAcademicYear ?? academicYear;
        if (statusAcademicYear && academicYearDataElement) {
            const matchingEnrollmentIds = new Set(
                teiEvents
                    .filter((event: any) =>
                        (event.dataValues ?? []).some((dv: any) =>
                            dv.dataElement === academicYearDataElement && String(dv.value) === String(statusAcademicYear)
                        )
                    )
                    .map((event: any) => event.enrollment)
            );
            isEnrolled = (tei.enrollments ?? []).some(
                (e: any) => {
                    return matchingEnrollmentIds.has(e.enrollment) && e.status === 'ACTIVE';
                }
            );
        } else {
            // Fallback: if no academic year filter, check if there's any ACTIVE enrollment
            // beyond the initial admission (more than 1 enrollment with at least one ACTIVE)
            const enrollmentCount = tei.enrollments?.length ?? 0;
            isEnrolled = enrollmentCount > 1 && (tei.enrollments ?? []).some((e: any) => e.status === 'ACTIVE');
        }
        const currentEnrollment = activeEnrollment ?? tei.enrollments?.[0];

        // Determine enrollment update strategy for the Enroll action:
        // Scenario A: TEI has 1 ACTIVE enrollment with NO registration events (admission-only).
        //   -> We UPDATE the existing enrollment (add events, set status).
        //   -> enrollableEnrollmentId = that enrollment's ID
        // Scenario B: TEI has an ACTIVE enrollment WITH registration events (e.g. enrolled for a past year).
        //   -> We need to COMPLETE it and CREATE a new enrollment.
        //   -> activeEnrollmentToComplete = that enrollment's ID
        const enrollments = tei.enrollments ?? [];
        const singleActiveEnrollment = enrollments.length === 1 && enrollments[0]?.status === 'ACTIVE'
            ? enrollments[0] : null;

        let enrollableEnrollmentId: string | undefined;
        let activeEnrollmentToComplete: string | undefined;
        let activeEnrollmentEnrolledAt: string | undefined;

        if (singleActiveEnrollment) {
            const hasEvents = teiEvents.some((event: any) => event.enrollment === singleActiveEnrollment.enrollment);
            if (!hasEvents) {
                // Scenario A: fresh admission, no events yet
                enrollableEnrollmentId = singleActiveEnrollment.enrollment;
            } else {
                // Scenario B: has events from previous enrollment, needs completing
                activeEnrollmentToComplete = singleActiveEnrollment.enrollment;
                activeEnrollmentEnrolledAt = (singleActiveEnrollment as any).enrolledAt;
            }
        } else if (activeEnrollment) {
            // Multiple enrollments but one is ACTIVE — may need completing
            activeEnrollmentToComplete = activeEnrollment.enrollment;
            activeEnrollmentEnrolledAt = (activeEnrollment as any).enrolledAt;
        }

        allRows.push({
            // TEI attributes
            ...attributes(tei.attributes ?? []),
            // Registration event data values (grade/standard, section, etc.) from the
            // latest enrollment event overall, regardless of ACTIVE/COMPLETED status.
            ...(eventForDisplayedValues ? dataValues(eventForDisplayedValues.dataValues ?? []) : {}),
            // Standard metadata
            registrationEvent: mostRecentEvent?.event,
            registrationEventOccurredAt: mostRecentEvent?.occurredAt,
            enrollmentId: currentEnrollment?.enrollment,
            enrollableEnrollmentId,
            activeEnrollmentToComplete,
            activeEnrollmentEnrolledAt,
            admissionId: tei.trackedEntity,
            trackedEntity: tei.trackedEntity,
            orgUnitId: currentEnrollment?.orgUnit,
            programId: currentEnrollment?.program,
            status: currentEnrollment?.status,
            hasActiveEnrollment: isEnrolled ? 'Yes' : 'No',
            ownershipOu: tei.programOwners?.[tei.programOwners.length - 1]?.orgUnit ??
                tei.programOwners?.[0]?.orgUnit,
        });
    }

    return allRows;
}

export function attendanceDataValuesFormater(data: AttendanceFormaterProps[], attendanceConfig: attendanceConfig): RowsDataProps {
    const localData: RowsDataProps = {}
    let status, absenceOption, eventId

    for (const event of data) {
        eventId = event.event
        for (const dataValue of event.dataValues) {
            if (attendanceConfig?.status === dataValue.dataElement) {
                status = dataValue.value
            }

            if (attendanceConfig?.absenceReason === dataValue.dataElement) {
                absenceOption = dataValue.value
            }
        }
        localData[event.occurredAt?.split("T")?.[0]] = { status, absenceOption, eventId }
    }
    return localData
}
