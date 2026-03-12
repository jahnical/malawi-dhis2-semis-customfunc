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
        const { page, pageSize, order, program, orgUnit, baseProgramStage, attributeFilters, academicYear, academicYearDataElement } = tableDataProps;

        // Step 1: Query TEIs directly with pagination and optional attribute filters
        const teiSearchQuery = makeCancellablePromise(
            engine.query({
                results: {
                    resource: "tracker/trackedEntities",
                    params: {
                        fields: "trackedEntity,createdAt,orgUnit,attributes[attribute,value],enrollments[enrollment,orgUnit,program,status],programOwners[orgUnit]",
                        ouMode: orgUnit != null ? "SELECTED" : "ACCESSIBLE",
                        page,
                        pageSize,
                        program: program as unknown as string,
                        orgUnit: orgUnit,
                        order: order || "createdAt:desc",
                        totalPages: true,
                        ...(attributeFilters?.length ? { filter: attributeFilters } : {})
                    }
                }
            }).catch((error: any) => {
                show({
                    message: `${("Could not get tracked entities")}: ${error.message}`,
                    type: { critical: true }
                });
                setTimeout(hide, 5000);
            })
        );

        requestRef.current.push(teiSearchQuery);
        const teiResponse = await teiSearchQuery;
        const teis = teiResponse?.results?.instances ?? teiResponse?.results?.trackedEntities ?? [];

        // Step 2: Get registration events for these TEIs
        let registrationEvents: any[] = [];
        if (teis.length > 0 && baseProgramStage) {
            const eventsQuery = makeCancellablePromise(
                engine.query({
                    results: {
                        resource: "tracker/events",
                        params: {
                            fields: "*",
                            ouMode: orgUnit != null ? "SELECTED" : "ACCESSIBLE",
                            program: program as unknown as string,
                            programStage: baseProgramStage,
                            orgUnit: orgUnit,
                            paging: false,
                        }
                    }
                }).catch((error: any) => {
                    show({
                        message: `${("Could not get events")}: ${error.message}`,
                        type: { critical: true }
                    });
                    setTimeout(hide, 5000);
                })
            );

            requestRef.current.push(eventsQuery);
            const eventsResponse = await eventsQuery;
            registrationEvents = eventsResponse?.results?.instances ?? eventsResponse?.results?.events ?? [];
        }

        // Step 3: Format data (TEI-first)
        const teiInstances = teis as unknown as FormatResponseRowsProps['teiInstances'];
        const registrationInstances = registrationEvents as unknown as FormatResponseRowsProps['registrationInstances'];

        return {
            formattedBasicTableData: formatAdmissionRowsData({ teiInstances, registrationInstances, academicYear, academicYearDataElement }),
            pagination: {
                page: teiResponse?.results?.page,
                pageSize: teiResponse?.results?.pageSize,
                totalPages: teiResponse?.results?.pageCount,
                totalElements: teiResponse?.results?.total
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
