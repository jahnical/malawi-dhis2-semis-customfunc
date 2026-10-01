import { useGetCompleteTeis } from "../tei/useGetCompleteTei";
import { useGetCompleteEvents } from "../events/useGetCompleteEvents";
import { planEnrollmentTransition, type ExistingEnrollment, type TransitionConflict, type TransitionPlan, type YearContext } from "../../utils/enrollment/enrollmentLifecycle";

const BATCH_SIZE = 50

// Enrollments only. Asking tracked entities for events[...] would return every event (daily attendance,
// marks, results, all years), and DHIS2 can't filter nested events by stage.
export const LEARNER_ENROLLMENT_FIELDS = "trackedEntity,enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,deleted]"
const STAGE_EVENT_FIELDS = "event,enrollment,programStage,orgUnit,occurredAt,scheduledAt,status,deleted,dataValues[dataElement,value]"

// Every enrollment of each tracked entity in one program, across all org units. Events are loaded only
// for the stages asked for (e.g. registration and socio-economics), per batch of enrollments, through
// /tracker/events?enrollments= (a list filter on 2.40 to 2.43). Without stages, enrollments have no events.
export function useGetLearnerEnrollments() {
    const { getCompleteTeis } = useGetCompleteTeis()
    const { getCompleteEvents } = useGetCompleteEvents()

    async function getLearnerEnrollments(trackedEntities: string[], program: string, { stages = [] }: { stages?: (string | undefined)[] } = {}): Promise<Map<string, ExistingEnrollment[]>> {
        const byTrackedEntity = new Map<string, ExistingEnrollment[]>()
        const ids = Array.from(new Set(trackedEntities.filter(Boolean)))

        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
            const response: any = await getCompleteTeis({
                program,
                trackedEntities: ids.slice(i, i + BATCH_SIZE),
                orgUnitMode: "ACCESSIBLE",
                paging: false,
                fields: LEARNER_ENROLLMENT_FIELDS,
            } as any)
            const teis = response?.results?.instances ?? response?.results?.trackedEntities ?? []
            for (const tei of teis) {
                byTrackedEntity.set(tei.trackedEntity, (tei?.enrollments ?? [])
                    .filter((enrollment: any) => !enrollment?.program || enrollment.program === program))
            }
        }
        for (const id of ids) if (!byTrackedEntity.has(id)) byTrackedEntity.set(id, [])

        const wanted = Array.from(new Set(stages.filter((stage): stage is string => Boolean(stage))))
        if (wanted.length > 0) {
            const byEnrollment = new Map<string, ExistingEnrollment>()
            for (const enrollments of byTrackedEntity.values()) {
                for (const enrollment of enrollments) {
                    enrollment.events = []
                    byEnrollment.set(enrollment.enrollment, enrollment)
                }
            }
            const enrollmentIds = Array.from(byEnrollment.keys())
            for (const programStage of wanted) {
                for (let i = 0; i < enrollmentIds.length; i += BATCH_SIZE) {
                    const response: any = await getCompleteEvents({
                        program,
                        programStage,
                        enrollments: enrollmentIds.slice(i, i + BATCH_SIZE),
                        orgUnitMode: "ACCESSIBLE",
                        paging: false,
                        fields: STAGE_EVENT_FIELDS,
                    } as any)
                    for (const event of response?.results?.instances ?? response?.results?.events ?? []) {
                        // Ignore anything outside the batch, should a server not apply the filter
                        byEnrollment.get(event?.enrollment)?.events?.push(event)
                    }
                }
            }
        }

        return byTrackedEntity
    }

    // One plan per tracked entity for registering them in targetAcademicYear. New people (no id yet) are
    // planned against no existing enrollments under the key "".
    // extraStages: other stages the caller reads from the returned enrollments (e.g. socio-economics)
    async function planEnrollments({ trackedEntities, program, targetAcademicYear, currentAcademicYear, registrationStage, academicYearDataElement, years, extraStages = [] }: {
        trackedEntities: (string | undefined)[]
        program: string
        targetAcademicYear: string
        currentAcademicYear: string
        registrationStage: string
        academicYearDataElement: string
        years?: YearContext
        extraStages?: (string | undefined)[]
    }): Promise<{ plans: Map<string, TransitionPlan>, enrollments: Map<string, ExistingEnrollment[]> }> {
        const ids = trackedEntities.filter((id): id is string => Boolean(id))
        // The plan needs each enrollment's registration event (its academic year)
        const enrollments = ids.length
            ? await getLearnerEnrollments(ids, program, { stages: [registrationStage, ...extraStages] })
            : new Map<string, ExistingEnrollment[]>()
        const plans = new Map<string, TransitionPlan>()
        for (const id of [...ids, ...(ids.length < trackedEntities.length ? [""] : [])]) {
            plans.set(id, planEnrollmentTransition({
                existing: enrollments.get(id) ?? [],
                targetAcademicYear, currentAcademicYear, registrationStage, academicYearDataElement, years,
            }))
        }
        return { plans, enrollments }
    }

    return { getLearnerEnrollments, planEnrollments }
}

// Shown when a plan has a conflict; callers translate it.
export const TRANSITION_CONFLICT_MESSAGES: Record<TransitionConflict, string> = {
    ALREADY_REGISTERED_FOR_YEAR: "Already registered for this academic year.",
    LATER_YEAR_ALREADY_ACTIVE: "Already enrolled in a later academic year.",
    UNKNOWN_ACADEMIC_YEAR: "The academic year could not be recognised. Check the academic year option and the school calendar.",
}
