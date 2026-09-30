import { useGetCompleteTeis } from "../tei/useGetCompleteTei";
import { planEnrollmentTransition, type ExistingEnrollment, type TransitionConflict, type TransitionPlan, type YearContext } from "../../utils/enrollment/enrollmentLifecycle";

const BATCH_SIZE = 50

export const LEARNER_ENROLLMENT_FIELDS = "trackedEntity,enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,deleted," +
    "events[event,enrollment,programStage,orgUnit,occurredAt,scheduledAt,status,deleted,dataValues[dataElement,value]]]"

// Every enrollment (with its events) of each tracked entity in one program, across all org units.
// Used to plan enrollment status changes (planEnrollmentTransition) before saving.
export function useGetLearnerEnrollments() {
    const { getCompleteTeis } = useGetCompleteTeis()

    async function getLearnerEnrollments(trackedEntities: string[], program: string): Promise<Map<string, ExistingEnrollment[]>> {
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

        return byTrackedEntity
    }

    // One plan per tracked entity for registering them in targetAcademicYear. New people (no id yet) are
    // planned against no existing enrollments under the key "".
    async function planEnrollments({ trackedEntities, program, targetAcademicYear, currentAcademicYear, registrationStage, academicYearDataElement, years }: {
        trackedEntities: (string | undefined)[]
        program: string
        targetAcademicYear: string
        currentAcademicYear: string
        registrationStage: string
        academicYearDataElement: string
        years?: YearContext
    }): Promise<{ plans: Map<string, TransitionPlan>, enrollments: Map<string, ExistingEnrollment[]> }> {
        const ids = trackedEntities.filter((id): id is string => Boolean(id))
        const enrollments = ids.length ? await getLearnerEnrollments(ids, program) : new Map<string, ExistingEnrollment[]>()
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
}
