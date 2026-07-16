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
        const { page, pageSize, order, program, orgUnit, baseProgramStage, attributeFilters, dataElementFilters, paging, transferConfig } = tableDataProps;

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
        let data = eventsResultsResponse?.results?.instances ? eventsResultsResponse?.results?.instances : eventsResultsResponse?.results?.events
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

        // Resolve the tracked entities for THIS PAGE's registration events. Batch
        // the lookup (tracker/trackedEntities accepts a ';'-separated id list) so a
        // page of N students costs one request instead of one request per student.
        const pageTeiIds = Array.from(new Set(
            (data as any[]).map((x: { trackedEntity: string }) => x.trackedEntity).filter(Boolean)
        )) as string[];
        const teis: any[] = [];
        if (pageTeiIds.length > 0) {
            const teiBatchSize = 50;
            const teiIdBatches: string[][] = [];
            for (let i = 0; i < pageTeiIds.length; i += teiBatchSize) {
                teiIdBatches.push(pageTeiIds.slice(i, i + teiBatchSize));
            }
            const teiQueries = teiIdBatches.map((batch) =>
                makeCancellablePromise(
                    getCompleteTeis({
                        orgUnitMode: "ACCESSIBLE",
                        paging: false,
                        program: program as unknown as string,
                        trackedEntities: batch.join(";"),
                    }).catch((error) => {
                        show({
                            message: `${("Could not get tracked entities")}: ${error.message}`,
                            type: { critical: true }
                        });
                        setTimeout(hide, 5000);
                        return null;
                    })
                )
            );
            teiQueries.forEach((p: any) => requestRef.current.push(p));
            const teiResponses = await Promise.all(teiQueries);
            for (const response of teiResponses) {
                const batchTeis = response?.results?.instances ?? response?.results?.trackedEntities ?? [];
                teis.push(...batchTeis);
            }
        }

        // Transfer events for the transfer-category column: fetch org-unit scoped
        // (plus a destination-school-filtered query to catch transfer INs recorded
        // in the origin school) in at most two requests, instead of one request per
        // student. formatRowsData matches them to each row by tracked entity, so
        // events belonging to students outside this page are simply ignored.
        if (transferConfig?.transferProgramStage) {
            const stage = transferConfig.transferProgramStage;
            const transferQueries: any[] = [];
            if (orgUnit) {
                transferQueries.push(
                    makeCancellablePromise(
                        getCompleteEvents({
                            orgUnit: orgUnit,
                            orgUnitMode: "DESCENDANTS",
                            program: program as unknown as string,
                            programStage: stage,
                            paging: false,
                        }).catch(() => null)
                    )
                );
            }
            if (orgUnit && transferConfig.destinySchoolDataElement) {
                transferQueries.push(
                    makeCancellablePromise(
                        getCompleteEvents({
                            orgUnitMode: "ACCESSIBLE",
                            program: program as unknown as string,
                            programStage: stage,
                            filter: [`${transferConfig.destinySchoolDataElement}:eq:${orgUnit}`],
                            paging: false,
                        }).catch(() => null)
                    )
                );
            }
            transferQueries.forEach((p: any) => requestRef.current.push(p));
            const transferResponses = await Promise.all(transferQueries);
            const seenEventIds = new Set<string>();
            const transferEvents: any[] = [];
            for (const response of transferResponses) {
                const events = response?.results?.instances ?? response?.results?.events ?? [];
                for (const event of events) {
                    if (event?.event && seenEventIds.has(event.event)) continue;
                    if (event?.event) seenEventIds.add(event.event);
                    transferEvents.push(event);
                }
            }
            data = [...data, ...transferEvents];
        }

        const registrationInstances = data as unknown as FormatResponseRowsProps['registrationInstances'];
        const teiInstances = teis as unknown as FormatResponseRowsProps['teiInstances'];

        return {
            registrationInstances,
            teiInstances,
            formattedBasicTableData: formatRowsData({ registrationInstances, teiInstances, isBasicStage: true, transferConfig, orgUnit }),
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
                    trackedEntity: formattedBasicTableData[i].trackedEntity,
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
        const { order, program, orgUnit, baseProgramStage, attributeFilters, academicYear, enrollmentStatusAcademicYear, academicYearDataElement, filterAdmissionByEventAcademicYear, transferConfig } = tableDataProps;

        // Query TEIs.
        // (Currently owned by OU) OR (Registration event in OU).
        // First, get TEIs owned by OU.
        // Apply academic year filter here
        const teiAttributeFilters = normalizeFilterExpressions(attributeFilters || []);
        if (academicYear && academicYearDataElement) {

        }

        // Fetch ALL tracked entities owned by this org unit (no server paging).
        // Transfer-out students are owned by *other* org units, so the server can't
        // paginate the combined (owned + transfer-out) set in one query. We instead
        // gather the whole set here, interleave the transfer-outs in sort order, and
        // paginate on the client so each student appears exactly once, on the right
        // page.
        const teiOwnedSearchQuery = makeCancellablePromise(
            getCompleteTeis({
                orgUnitMode: "DESCENDANTS",
                paging: false,
                program: program as unknown as string,
                orgUnit: orgUnit,
                order: order || "createdAt:desc",
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

        // Fetch transfer-stage events up front (org-unit scoped, not per tracked
        // entity) — they are needed both to classify transfers for display and to
        // identify students who transferred OUT of this org unit:
        //   - Transfer OUT events are recorded in this org unit (destination is a
        //     different school), so a DESCENDANTS query picks them up.
        //   - Transfer IN events are recorded in the origin org unit with this org
        //     unit as their destination, fetched via the destination-school filter.
        let transferEvents: any[] = [];
        if (orgUnit && transferConfig?.transferProgramStage) {
            const stage = transferConfig.transferProgramStage;
            const transferQueries: any[] = [
                makeCancellablePromise(
                    getCompleteEvents({
                        orgUnit: orgUnit,
                        orgUnitMode: "DESCENDANTS",
                        program: program as unknown as string,
                        programStage: stage,
                        paging: false,
                    }).catch(() => null)
                ),
            ];

            if (transferConfig.destinySchoolDataElement) {
                transferQueries.push(
                    makeCancellablePromise(
                        getCompleteEvents({
                            orgUnitMode: "ACCESSIBLE",
                            program: program as unknown as string,
                            programStage: stage,
                            filter: [`${transferConfig.destinySchoolDataElement}:eq:${orgUnit}`],
                            paging: false,
                        }).catch(() => null)
                    )
                );
            }

            transferQueries.forEach((query) => requestRef.current.push(query));
            const transferResponses = await Promise.all(transferQueries);
            const seenEventIds = new Set<string>();
            for (const response of transferResponses) {
                const events = response?.results?.instances ?? response?.results?.events ?? [];
                for (const event of events) {
                    if (event?.event && seenEventIds.has(event.event)) continue;
                    if (event?.event) seenEventIds.add(event.event);
                    transferEvents.push(event);
                }
            }
        }

        // Students who transferred OUT have a transfer event whose destination is a
        // *different* org unit. They're now owned elsewhere, so they aren't in the
        // owned page and must be fetched separately to appear (tagged Transfer OUT).
        // Deriving this from transfer events — rather than "any student with a
        // registration event here" — is what keeps the current page from pulling in
        // every student owned on other pages (which broke pagination).
        const readDestinySchool = (event: any): string | undefined => {
            const raw = (event?.dataValues ?? []).find(
                (dv: any) => dv.dataElement === transferConfig?.destinySchoolDataElement
            )?.value;
            return (typeof raw === "object" && raw) ? raw.id : raw;
        };
        const transferOutTeiIds: string[] = transferConfig?.destinySchoolDataElement
            ? Array.from(new Set(
                transferEvents
                    .filter((event: any) => {
                        const destiny = readDestinySchool(event);
                        return destiny && destiny !== orgUnit;
                    })
                    .map((event: any) => event.trackedEntity)
                    .filter(Boolean)
            ))
            : [];

        // Combine IDs, ensuring we don't duplicate
        const ownedTeiIds = ownedTeis.map((t: any) => t.trackedEntity);
        const missingTeiIds = transferOutTeiIds.filter(id => !ownedTeiIds.includes(id));
        let additionalTeis: any[] = [];
        if (missingTeiIds.length > 0) {
            // Fetch missing TEIs in batches to keep each request URL within server
            // limits. A single request with many ids overflows the URI (HTTP 414),
            // which is easy to hit on large org units.
            const idBatchSize = 50;
            const idBatches: string[][] = [];
            for (let i = 0; i < missingTeiIds.length; i += idBatchSize) {
                idBatches.push(missingTeiIds.slice(i, i + idBatchSize));
            }

            const missingTeisQueries = idBatches.map((batch) =>
                makeCancellablePromise(
                    getCompleteTeis({
                        ouMode: "ACCESSIBLE",
                        program: program as unknown as string,
                        trackedEntities: batch.join(";"),
                        paging: false,
                    }).catch(() => null)
                )
            );
            missingTeisQueries.forEach((query) => requestRef.current.push(query));
            const missingTeisResponses = await Promise.all(missingTeisQueries);
            for (const response of missingTeisResponses) {
                const batchTeis = response?.results?.instances ?? response?.results?.trackedEntities ?? [];
                additionalTeis = [...additionalTeis, ...batchTeis];
            }
        }

        // Merge owned + transferred-out students into one list, de-duplicated by id
        // (a transfer-out already present as owned keeps its owned record).
        const combinedById = new Map<string, any>();
        for (const tei of [...ownedTeis, ...additionalTeis]) {
            if (tei?.trackedEntity && !combinedById.has(tei.trackedEntity)) {
                combinedById.set(tei.trackedEntity, tei);
            }
        }
        let combinedTeis = Array.from(combinedById.values());

        if (teiAttributeFilters.length) {
            combinedTeis = combinedTeis.filter((tei: any) => matchesTeiAttributeFilters(tei, teiAttributeFilters));
        }

        // Default ordering: transfer-outs interleaved with owned students by createdAt
        // (newest first), matching the owned query's default order. The caller applies
        // any user-selected sort on the client, on top of this.
        combinedTeis.sort((a: any, b: any) =>
            new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
        );

        // Fetch every registration event in this org unit (and its descendants) in
        // ONE query, rather than per tracked entity. Unlike tracker/trackedEntities,
        // the tracker/events `trackedEntity` filter only accepts a SINGLE id (a
        // semicolon-joined list of ids is rejected with E1003, "does not exist" —
        // DHIS2 tries to look up the whole joined string as one id), so per-TEI
        // batching isn't an option here; this org-unit-scoped fetch is what covers
        // the students being displayed.
        let baseEvents: any[] = [];
        if (orgUnit && baseProgramStage) {
            const registrationEventsQuery = makeCancellablePromise(
                getCompleteEvents({
                    orgUnit: orgUnit,
                    orgUnitMode: "DESCENDANTS",
                    program: program as unknown as string,
                    programStage: baseProgramStage,
                    paging: false,
                }).catch(() => null)
            );
            requestRef.current.push(registrationEventsQuery);
            const registrationEventsResponse = await registrationEventsQuery;
            baseEvents = registrationEventsResponse?.results?.instances ?? registrationEventsResponse?.results?.events ?? [];
        }

        // Registration events (all base-stage events in this org unit) combined with
        // the transfer events. formatAdmissionRowsData filters these per tracked
        // entity, so events for students outside the current page are simply ignored.
        const registrationEvents: any[] = [...baseEvents, ...transferEvents];

        // Format the FULL result set (all owned + transferred-out students). Pagination
        // and user-driven sorting are applied on the client, so navigating pages or
        // changing the sort never triggers another fetch.
        const teiInstances = combinedTeis as unknown as FormatResponseRowsProps['teiInstances'];
        const registrationInstances = registrationEvents as unknown as FormatResponseRowsProps['registrationInstances'];
        const formattedBasicTableData = formatAdmissionRowsData({ teiInstances, registrationInstances, academicYear, enrollmentStatusAcademicYear, academicYearDataElement, filterAdmissionByEventAcademicYear, orgUnit, transferConfig });

        return {
            formattedBasicTableData,
            pagination: {
                page: 1,
                pageSize: formattedBasicTableData.length,
                totalPages: 1,
                totalElements: formattedBasicTableData.length
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
