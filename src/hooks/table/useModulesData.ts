import { useRef } from "react";
import { Modules } from "dhis2-semis-types";
import { useGetTeis } from "../tei/useGetTei";
import { useDataEngine } from "@dhis2/app-runtime";
import useShowAlerts from "../commons/useShowAlert";
import { useGetEvents } from "../events/useGetEvents";
import { useGetCompleteTeis } from "../tei/useGetCompleteTei";
import { RequestBroker } from "../requestBroker/requestBroker";
import { GetTableDataProps } from "../../types/table/tableDataProps";
import { useGetCompleteEvents } from "../events/useGetCompleteEvents";
import { TeiQueryResults } from "../../types/api/WithRegistrationTypes";
import { EventQueryResults } from "../../types/api/WithoutRegistrationTypes";
import { FormatResponseRowsProps } from "../../types/common/FormatRowsDataProps";
import { attendanceDataValuesFormater, formatRowsData, formatAdmissionRowsData } from "../../utils/table/rows/formatRowsData";

function getTeiAttributeValue(tei: any, attributeId: string) {
    return (tei?.attributes ?? []).find((attribute: any) => attribute.attribute === attributeId)?.value;
}

function matchesFilterExpression(value: unknown, expression: string) {
    const [fieldId, operator, firstValue, ...rest] = expression.split(":");
    if (!fieldId || !operator) return true;
    if (value === undefined || value === null) return false;

    const valueString = String(value);
    const normalizedValue = valueString.toLowerCase();

    switch (operator) {
        case "eq":
            return normalizedValue === String(firstValue ?? "").toLowerCase();
        case "in":
            return String([firstValue, ...rest].join(":") ?? "")
                .split(";")
                .map((option) => option.toLowerCase())
                .includes(normalizedValue);
        case "like":
            return normalizedValue.includes(String([firstValue, ...rest].join(":") ?? "").toLowerCase());
        case "ge": {
            const leIndex = rest.findIndex((token) => token === "le");
            const endValue = leIndex > -1 ? rest[leIndex + 1] : undefined;

            if (firstValue && valueString < firstValue) return false;
            if (endValue && valueString > endValue) return false;
            return true;
        }
        default:
            return true;
    }
}

function matchesTeiAttributeFilters(tei: any, filters: any[]) {
    return filters.every((filter: any) => {
        const expression = Array.isArray(filter) ? filter[0] : filter;
        if (typeof expression !== "string") return true;

        const [attributeId] = expression.split(":");
        return matchesFilterExpression(getTeiAttributeValue(tei, attributeId), expression);
    });
}

function normalizeFilterExpressions(filters: any[] = []) {
    return filters.reduce((acc: string[], filter: any) => {
        const expression = Array.isArray(filter) ? filter[0] : filter;
        if (typeof expression === "string") acc.push(expression);
        return acc;
    }, []);
}



export function useModulesData() {
    // const { getTeis } = useGetTeis()
    // const { getEvents } = useGetEvents()
    const { getCompleteTeis } = useGetCompleteTeis()
    const { getCompleteEvents } = useGetCompleteEvents()
    const requestRef = useRef<any[]>([]);
    const { hide, show } = useShowAlerts()
    const { cancelAllOperations, makeCancellablePromise } = RequestBroker({ requestRef })
    const engine = useDataEngine()

    async function getRegistrationData(tableDataProps: GetTableDataProps) {
        const { page, pageSize, order, program, orgUnit, baseProgramStage, attributeFilters, dataElementFilters, paging } = tableDataProps;

        const eventsResults = await getCompleteEvents({
            orgUnitMode: orgUnit != null ? "SELECTED" : "ACCESSIBLE",
            page,
            pageSize,
            ...(paging ? { paging } : {}),
            program: program as unknown as string,
            order: order || "occurredAt:desc",
            programStage: baseProgramStage,
            filter: dataElementFilters,
            filterAttributes: attributeFilters,
            orgUnit: orgUnit
        }).catch((error) => {
            show({
                message: `${("Could not get events")}: ${error.message}`,
                type: { critical: true }
            });
            setTimeout(hide, 5000);
        }) as unknown as EventQueryResults;
        const data = eventsResults?.results?.instances ? eventsResults?.results?.instances : eventsResults?.results?.events
        const registrationTrackedEntities = data?.map((x: { trackedEntity: string }) => x.trackedEntity) ?? []

        return { registrationEvents: data as unknown as FormatResponseRowsProps['registrationInstances'], registrationTrackedEntities };
    }

    async function getBasicData(tableDataProps: GetTableDataProps) {
        cancelAllOperations()
        const { page, pageSize, order, program, orgUnit, baseProgramStage, attributeFilters, dataElementFilters, paging } = tableDataProps;

        const eventsResults = makeCancellablePromise(
            getCompleteEvents({
                orgUnitMode: orgUnit != null ? "SELECTED" : "ACCESSIBLE",
                page,
                pageSize,
                ...(paging ? { paging } : {}),
                program: program as unknown as string,
                order: order || "occurredAt:desc",
                programStage: baseProgramStage,
                filter: dataElementFilters,
                filterAttributes: attributeFilters,
                orgUnit: orgUnit,
                totalPages: true
            })
                .catch((error) => {
                    show({
                        message: `${("Could not get events")}: ${error.message}`,
                        type: { critical: true }
                    });
                    setTimeout(hide, 5000);
                })
        )

        requestRef.current.push(eventsResults);
        const eventsResultsResponse = await eventsResults
        const data = eventsResultsResponse?.results?.instances ? eventsResultsResponse?.results?.instances : eventsResultsResponse?.results?.events
        if (!data || data.length === 0) {
            return {
                registrationInstances: [],
                teiInstances: [],
                formattedBasicTableData: [],
                pagination: {
                    page: eventsResultsResponse?.results?.pager?.page ?? eventsResultsResponse?.results?.page ?? page,
                    pageSize: eventsResultsResponse?.results?.pager?.pageSize ?? eventsResultsResponse?.results?.pageSize ?? pageSize,
                    totalPages: eventsResultsResponse?.results?.pager?.pageCount ?? eventsResultsResponse?.results?.pageCount ?? 0,
                    totalElements: eventsResultsResponse?.results?.pager?.total ?? eventsResultsResponse?.results?.total ?? 0,
                }
            }
        }

        const registrationTrackedEntities = data.map((x: { trackedEntity: string }) => x.trackedEntity).toString()

        const teiResults = registrationTrackedEntities?.length > 0
            && makeCancellablePromise(
                getCompleteTeis({
                    orgUnitMode: "ACCESSIBLE",
                    paging: false,
                    program: program as unknown as string,
                    trackedEntities: registrationTrackedEntities,
                }).catch((error) => {
                    show({
                        message: `${("Could not get traked entities")}: ${error.message}`,
                        type: { critical: true }
                    });
                    setTimeout(hide, 5000);
                })
            )

        requestRef.current.push(teiResults);
        const teiResultsResponse = registrationTrackedEntities?.length > 0 ? await teiResults : { results: { instances: [], trackedEntities: [] } } as unknown as TeiQueryResults
        const teis = teiResultsResponse?.results?.instances ? teiResultsResponse?.results?.instances : teiResultsResponse?.results?.trackedEntities

        const registrationInstances = data as unknown as FormatResponseRowsProps['registrationInstances'];
        const teiInstances = teis as unknown as FormatResponseRowsProps['teiInstances'];

        return {
            registrationInstances,
            teiInstances,
            formattedBasicTableData: formatRowsData({ registrationInstances, teiInstances, isBasicStage: true }),
            pagination: {
                page: eventsResultsResponse?.results?.pager?.page ?? eventsResultsResponse?.results?.page,
                pageSize: eventsResultsResponse?.results?.pager?.pageSize ?? eventsResultsResponse?.results?.pageSize,
                totalPages: eventsResultsResponse?.results?.pager?.pageCount ??  eventsResultsResponse?.results?.pageCount,
                totalElements: eventsResultsResponse?.results?.pager?.total ?? eventsResultsResponse?.results?.total,
            }
        }
    }

    async function getStageData({ tableDataProps, formattedBasicTableData, module }: { tableDataProps: GetTableDataProps, formattedBasicTableData: any, module?: Modules }) {
        const { order, program, orgUnit, baseProgramStage, occurredAfter, occurredBefore, attendanceConfig } = tableDataProps;
        let copy = []

        for (let i = 0; i < formattedBasicTableData.length; i++) {
            const cancelable = makeCancellablePromise(
                getCompleteEvents({
                    orgUnitMode: orgUnit != null ? "SELECTED" : "ACCESSIBLE",
                    program: program as unknown as string,
                    order: order || "occurredAt:desc",
                    programStage: baseProgramStage!,
                    orgUnit: orgUnit,
                    trackedEntities: formattedBasicTableData[i].trackedEntity,
                    ...(occurredAfter ? { occurredAfter: occurredAfter } : {}),
                    ...(occurredBefore ? { occurredBefore: occurredBefore } : {})
                }).catch((error) => {
                    show({
                        message: `${("Could not get events")}: ${error.message}`,
                        type: { critical: true }
                    });
                    setTimeout(hide, 5000);
                })
            )

            const eventsResults = await cancelable as unknown as EventQueryResults;
            requestRef.current.push(cancelable);
            const data = eventsResults?.results?.instances ? eventsResults?.results?.instances : eventsResults?.results?.events ?? []
            const filteredEvents = data.filter((x: any) => x.enrollment === formattedBasicTableData[i].enrollmentId) as unknown as any || []

            copy[i] = {
                ...(Modules.Attendance == module ?
                    attendanceDataValuesFormater(filteredEvents, attendanceConfig as unknown as any)
                    : formatRowsData({ registrationInstances: filteredEvents ?? [], teiInstances: [], isBasicStage: false })[0]),
                ...formattedBasicTableData[i], ...(Modules.Final_Result == module ? { frEvent: filteredEvents[0] ?? {} } : {})
            }
        }

        return {
            formattedStagedData: copy
        }
    }

    /**
     * TEI-first data fetching for the Admission module.
     * Queries tracked entities directly (with optional attribute filters),
     * then fetches their registration events for additional data (grade, etc.).
     * This ensures TEIs without registration events still appear.
     */
    async function getAdmissionData(tableDataProps: GetTableDataProps) {
        console.log("Fetching admission data with TEI-first approach:", tableDataProps);
        cancelAllOperations()
        const { page, pageSize, order, program, orgUnit, baseProgramStage, attributeFilters, academicYear, enrollmentStatusAcademicYear, academicYearDataElement, filterAdmissionByEventAcademicYear, transferConfig } = tableDataProps;

        // Query TEIs.
        // (Currently owned by OU) OR (Registration event in OU).
        // First, get TEIs owned by OU.
        // Apply academic year filter here
        const teiAttributeFilters = normalizeFilterExpressions(attributeFilters || []);
        if (academicYear && academicYearDataElement) {

        }

        const teiOwnedSearchQuery = makeCancellablePromise(
            getCompleteTeis({
                orgUnitMode: "DESCENDANTS",
                page,
                pageSize,
                program: program as unknown as string,
                orgUnit: orgUnit,
                order: order || "createdAt:desc",
                totalPages: true,
                ...(teiAttributeFilters.length ? { filter: teiAttributeFilters } : {})
            }).catch((error: any) => {
                show({
                    message: `${("Could not get tracked entities")}: ${error.message}`,
                    type: { critical: true }
                });
                setTimeout(hide, 5000);
            })
        );

        requestRef.current.push(teiOwnedSearchQuery);
        const teiOwnedResponse = await teiOwnedSearchQuery;
        let ownedTeis = teiOwnedResponse?.results?.instances ?? teiOwnedResponse?.results?.trackedEntities ?? [];

        // Supplemental query for "Transfer OUT" students.
        // We look for registration events originally in this OU for students now owned elsewhere.
        // This is only necessary if we are on the first page or if we want to ensure visibility.
        // For simplicity and to avoid missing students, we fetch them if baseProgramStage is available.
        let transferOutTeiIds: string[] = [];
        if (orgUnit && baseProgramStage) {
            const transferOutEventsQuery = makeCancellablePromise(
                getCompleteEvents({
                    orgUnit: orgUnit,
                    orgUnitMode: "SELECTED",
                    program: program as unknown as string,
                    programStage: baseProgramStage,
                    paging: false,
                }).catch(() => null)
            );
            requestRef.current.push(transferOutEventsQuery);
            const transferOutResponse = await transferOutEventsQuery;
            const events = transferOutResponse?.results?.instances ?? transferOutResponse?.results?.events ?? [];
            transferOutTeiIds = events.map((e: any) => e.trackedEntity).filter(Boolean);
        }

        // Combine IDs, ensuring we don't duplicate
        const ownedTeiIds = ownedTeis.map((t: any) => t.trackedEntity);
        const allRelevantTeiIds = Array.from(new Set([...ownedTeiIds, ...transferOutTeiIds]));

        // If we found extra IDs (transferred out), we need to fetch their TEI objects
        // if they weren't in the primary "owned" search results.
        const missingTeiIds = allRelevantTeiIds.filter(id => !ownedTeiIds.includes(id));
        let additionalTeis: any[] = [];
        if (missingTeiIds.length > 0) {
            const missingTeisQuery = makeCancellablePromise(
                getCompleteTeis({
                    ouMode: "ACCESSIBLE",
                    program: program as unknown as string,
                    trackedEntities: missingTeiIds.join(";"),
                    paging: false,
                }).catch(() => null)
            );
            requestRef.current.push(missingTeisQuery);
            const missingTeisResponse = await missingTeisQuery;
            additionalTeis = missingTeisResponse?.results?.instances ?? missingTeisResponse?.results?.trackedEntities ?? [];
        }

        let teis = [...ownedTeis, ...additionalTeis];

        if (teiAttributeFilters.length) {
            teis = teis.filter((tei: any) => matchesTeiAttributeFilters(tei, teiAttributeFilters));
        }

        // Get registration and transfer events for these TEIs across ALL OUs
        // so we can see where they went (Transfer OUT) or where they came from (Transfer IN).
        let registrationEvents: any[] = [];
        if (teis.length > 0 && baseProgramStage) {
            const stagesToQuery = [baseProgramStage, transferConfig?.transferProgramStage].filter(Boolean);
            
            // We only query events for TEIs that were successfully resolved/found
            const validTeiIds = teis.map((t: any) => t.trackedEntity);
            const batchSize = 10;
            const teiBatches = [];
            for (let i = 0; i < validTeiIds.length; i += batchSize) {
                teiBatches.push(validTeiIds.slice(i, i + batchSize));
            }

            const eventsQueries: any[] = [];
            for (const stage of stagesToQuery) {
                for (const batch of teiBatches) {
                    const query = async () => {
                        try {
                            const response = await getCompleteEvents({
                                ouMode: "ACCESSIBLE",
                                program: program as unknown as string,
                                programStage: stage,
                                trackedEntity: batch.join(";"),
                                paging: false,
                            });
                            return response;
                        } catch (error: any) {
                            // If a batch fails (e.g., 400 Bad Request because one TEI is invalid),
                            // try fetching events individually for each TEI in this batch.
                            console.warn(`Batch request failed for stage ${stage}, retrying individually...`, batch, error);
                            const individualEvents: any[] = [];
                            for (const teiId of batch) {
                                try {
                                    const response = await getCompleteEvents({
                                        ouMode: "ACCESSIBLE",
                                        program: program as unknown as string,
                                        programStage: stage,
                                        trackedEntity: teiId,
                                        paging: false,
                                    });
                                    const events = response?.results?.instances ?? response?.results?.events ?? [];
                                    individualEvents.push(...events);
                                } catch (indError) {
                                    console.error(`Failed to fetch events for individual TEI ${teiId}`, indError);
                                }
                            }
                            // Return a mock response structure that the loop below expects
                            return { results: { instances: individualEvents } };
                        }
                    };
                    eventsQueries.push(query());
                }
            }

            try {
                const eventsResponses = await Promise.all(eventsQueries);
                for (const response of eventsResponses) {
                    if (!response) continue;
                    const events = response?.results?.instances ?? response?.results?.events ?? [];
                    registrationEvents = [...registrationEvents, ...events];
                }
            } catch (error: any) {
                show({
                    message: `${("Could not get events")}: ${error.message}`,
                    type: { critical: true }
                });
                setTimeout(hide, 5000);
            }
        }

        // Format data (TEI-first)
        const teiInstances = teis as unknown as FormatResponseRowsProps['teiInstances'];
        const registrationInstances = registrationEvents as unknown as FormatResponseRowsProps['registrationInstances'];
        const formattedBasicTableData = formatAdmissionRowsData({ teiInstances, registrationInstances, academicYear, enrollmentStatusAcademicYear, academicYearDataElement, filterAdmissionByEventAcademicYear, orgUnit, transferConfig });

        return {
            formattedBasicTableData,
            pagination: {
                page: teiOwnedResponse?.results?.page ?? teiOwnedResponse?.results?.pager?.page,
                pageSize: teiOwnedResponse?.results?.pageSize ?? teiOwnedResponse?.results?.pager?.pageSize,
                totalPages: teiOwnedResponse?.results?.pageCount ?? teiOwnedResponse?.results?.pager?.pageCount,
                totalElements: teiOwnedResponse?.results?.total ?? teiOwnedResponse?.results?.pager?.total ?? formattedBasicTableData.length
            }
        };
    }

    return {
        getRegistrationData,
        getBasicData,
        getStageData,
        getAdmissionData
    }
}
