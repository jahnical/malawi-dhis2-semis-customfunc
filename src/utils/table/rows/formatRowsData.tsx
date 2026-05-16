import { attributesProps } from "../../../types/api/WithRegistrationTypes";
import { dataValuesProps } from "../../../types/api/WithoutRegistrationTypes";
import { attendanceConfig, AttendanceFormaterProps } from "src/types/table/FormatRowsDataTypes";
import { FormatResponseRowsProps, RowsDataProps } from "../../../types/common/FormatRowsDataProps";

export function formatRowsData({ registrationInstances, teiInstances, isBasicStage = false, transferConfig, orgUnit }: FormatResponseRowsProps): RowsDataProps[] {
    const allRows: RowsDataProps[] = [];

    // Separate registration events from other events (like transfer events)
    // In basic stage, we usually display one row per enrollment/registration event
    const mainEvents = registrationInstances?.filter(e => !transferConfig || (e.programStage || e.programStageId) !== transferConfig.transferProgramStage) ?? [];
    
    // If no main events (e.g. only transfer events fetched), we might need to use all registrationInstances
    const eventsToMap = mainEvents.length > 0 ? mainEvents : (registrationInstances ?? []);

    for (const event of eventsToMap) {
        const teiDetails = teiInstances?.find(tei => tei.trackedEntity === event.trackedEntity);

        // Find the enrollment that matches the current academic year event's 
        const currentEnrollment = teiDetails?.enrollments?.find(enrollment => enrollment.enrollment === event.enrollment);

        // Check if the TEI has any active enrollment
        const hasActiveEnrollment = teiDetails?.enrollments?.some(enrollment => enrollment.status === 'ACTIVE') ?? false;

        // Determine transfer status
        let transferCategory = "_";
        if (transferConfig) {
            // Look through ALL instances for this TEI to find the transfer event
            const teiEvents = (registrationInstances ?? [])
                .filter((e: any) => e.trackedEntity === event.trackedEntity);

            const transferEvent = teiEvents.find((e: any) => {
                const psId = e.programStage || e.programStageId;
                const configPsId = transferConfig.transferProgramStage;
                return psId === configPsId || (typeof psId === 'object' && (psId?.id === configPsId || psId === configPsId));
            });

            if (transferEvent) {
                const destinySchoolValue = transferEvent.dataValues?.find((dv: any) => dv.dataElement === transferConfig.destinySchoolDataElement)?.value;
                const originSchoolValue = transferConfig.originSchoolDataElement
                    ? transferEvent.dataValues?.find((dv: any) => dv.dataElement === transferConfig.originSchoolDataElement)?.value
                    : null;

                const destinySchool = (typeof destinySchoolValue === 'object' && destinySchoolValue !== null) ? (destinySchoolValue as any)?.id : destinySchoolValue;
                const originSchool = (typeof originSchoolValue === 'object' && originSchoolValue !== null) ? (originSchoolValue as any)?.id : originSchoolValue;

                const eventOrgUnitId = transferEvent.orgUnitId || (typeof transferEvent.orgUnit === 'object' ? (transferEvent.orgUnit?.id || transferEvent.orgUnit) : transferEvent.orgUnit);

                if (destinySchool === orgUnit || (typeof destinySchool === 'object' && destinySchool?.id === orgUnit)) {
                    transferCategory = "Transfer IN";
                } else if ((eventOrgUnitId === orgUnit || originSchool === orgUnit || (typeof originSchool === 'object' && originSchool?.id === orgUnit)) && destinySchool && destinySchool !== orgUnit) {
                    transferCategory = "Transfer OUT";
                } else if ((originSchool === orgUnit || (typeof originSchool === 'object' && originSchool?.id === orgUnit)) && !destinySchool) {
                    transferCategory = "Transfer OUT";
                } else if (eventOrgUnitId === orgUnit && destinySchool && destinySchool !== orgUnit) {
                    transferCategory = "Transfer OUT";
                }
            }
        }

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
                    transferCategory,
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

function formatRegistrationEvents(events: any[] = []): RowsDataProps[] {
    return events.map((event: any) => ({
        id: event?.event,
        event: event?.event,
        trackedEntity: event?.trackedEntity,
        active: event?.active,
        enrollment: event?.enrollment,
        orgUnitName: event?.orgUnitName,
        orgUnitId: event?.orgUnit,
        ...dataValues(event?.dataValues ?? []),
    }));
}

function extractAcademicYearTokens(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    const matches = String(value).match(/\d{4}/g);
    return matches ?? [];
}

function matchesAcademicYearValue(eventAcademicYearValue: unknown, statusAcademicYear: unknown): boolean {
    if (eventAcademicYearValue === undefined || eventAcademicYearValue === null) return false;
    if (statusAcademicYear === undefined || statusAcademicYear === null) return false;

    const eventValue = String(eventAcademicYearValue).trim();
    const statusValue = String(statusAcademicYear).trim();

    if (!eventValue || !statusValue) return false;
    if (eventValue === statusValue) return true;

    const eventTokens = extractAcademicYearTokens(eventValue);
    const statusTokens = extractAcademicYearTokens(statusValue);

    if (!eventTokens.length || !statusTokens.length) {
        return false;
    }

    return eventTokens.some((token) => statusTokens.includes(token));
}

/**
 * TEI-first row formatter for the Admission module.
 * Iterates over TEIs (not events), attaching registration event data when available.
 * This ensures TEIs without registration events still appear in the table.
 */
export function formatAdmissionRowsData({ teiInstances, registrationInstances, academicYear, enrollmentStatusAcademicYear, academicYearDataElement, filterAdmissionByEventAcademicYear, orgUnit, transferConfig }: FormatResponseRowsProps): RowsDataProps[] {
    const allRows: RowsDataProps[] = [];

    for (const tei of teiInstances ?? []) {
        // Find registration events for this TEI
        const teiEvents = (registrationInstances ?? [])
            .filter((event: any) => event.trackedEntity === tei.trackedEntity)
            .sort((a: any, b: any) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime());

        // Fallback academic-year filtering for configurations without an
        // admission-date attribute. When admission-date filtering is active,
        // requiring a registration event would hide valid admission-only TEIs.
        if (filterAdmissionByEventAcademicYear && academicYear && academicYearDataElement) {
            const hasEventForSelectedYear = teiEvents.some((event: any) =>
                (event.dataValues ?? []).some((dv: any) =>
                    dv.dataElement === academicYearDataElement && matchesAcademicYearValue(dv.value, academicYear)
                )
            );
            if (!hasEventForSelectedYear) continue;
        }

        const mostRecentEvent = teiEvents[0];
        const activeEnrollment = tei.enrollments?.find((e: any) => e.status === 'ACTIVE');
        const eventForDisplayedValues = mostRecentEvent;

        // Determine transfer status
        let transferCategory = "_";
        if (transferConfig) {
            const transferEvent = teiEvents.find((event: any) => {
                const psId = event.programStage || event.programStageId;
                const configPsId = transferConfig.transferProgramStage;
                return psId === configPsId || (typeof psId === 'object' && (psId?.id === configPsId || psId === configPsId));
            });

            if (transferEvent) {
                const destinySchoolValue = transferEvent.dataValues?.find((dv: any) => dv.dataElement === transferConfig.destinySchoolDataElement)?.value;
                const originSchoolValue = transferConfig.originSchoolDataElement 
                    ? transferEvent.dataValues?.find((dv: any) => dv.dataElement === transferConfig.originSchoolDataElement)?.value
                    : null;
                
                const destinySchool = (typeof destinySchoolValue === 'object' && destinySchoolValue !== null) ? (destinySchoolValue as any)?.id : destinySchoolValue;
                const originSchool = (typeof originSchoolValue === 'object' && originSchoolValue !== null) ? (originSchoolValue as any)?.id : originSchoolValue;

                const eventOrgUnitId = transferEvent.orgUnitId || (typeof transferEvent.orgUnit === 'object' ? (transferEvent.orgUnit?.id || transferEvent.orgUnit) : transferEvent.orgUnit);

                if (destinySchool === orgUnit || (typeof destinySchool === 'object' && destinySchool?.id === orgUnit)) {
                    transferCategory = "Transfer IN";
                } else if ((eventOrgUnitId === orgUnit || originSchool === orgUnit || (typeof originSchool === 'object' && originSchool?.id === orgUnit)) && destinySchool && destinySchool !== orgUnit) {
                    transferCategory = "Transfer OUT";
                } else if ((originSchool === orgUnit || (typeof originSchool === 'object' && originSchool?.id === orgUnit)) && !destinySchool) {
                    transferCategory = "Transfer OUT";
                } else if (eventOrgUnitId === orgUnit && destinySchool && destinySchool !== orgUnit) {
                    transferCategory = "Transfer OUT";
                }
            }
        }

        // Determine enrollment status by checking for an ACTIVE enrollment
        // in the current/default academic year.
        // Registration events store the academic year as a data element value.
        // We match events for the status year, then check if their enrollment is ACTIVE.
        let isEnrolled = false;
        const statusAcademicYear = enrollmentStatusAcademicYear ?? academicYear;
        if (statusAcademicYear) {
            const matchingEnrollmentIds = new Set(
                teiEvents
                    .filter((event: any) =>
                        (event.dataValues ?? []).some((dv: any) => {
                            const matchesConfiguredAcademicYearElement = academicYearDataElement
                                ? dv.dataElement === academicYearDataElement
                                : true;

                            return matchesConfiguredAcademicYearElement && matchesAcademicYearValue(dv.value, statusAcademicYear);
                        })
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
            registrationEvents: formatRegistrationEvents(teiEvents),
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
            transferCategory,
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
