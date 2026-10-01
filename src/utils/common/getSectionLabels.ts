import { type SectionType } from "dhis2-semis-types";

interface Translator {
    t: (key: string, options?: any) => string
}

export interface SectionLabels {
    // "student" / "staff member", for sentences about one person
    singular: string
    // "students" / "staff", for sentences about many people
    plural: string
    // "Student" / "Staff", for headings such as "Student Profile"
    title: string
}

// Keep each string a literal inside i18n.t so it is picked up by translation extraction
const sectionLabels: Record<SectionType, (i18n: Translator) => SectionLabels> = {
    student: (i18n) => ({
        singular: i18n.t("learner"),
        plural: i18n.t("learners"),
        title: i18n.t("Learner"),
    }),
    staff: (i18n) => ({
        singular: i18n.t("staff member"),
        plural: i18n.t("staff"),
        title: i18n.t("Staff"),
    }),
}

export const getSectionLabels = (sectionType: string | null | undefined, i18n: Translator): SectionLabels =>
    (sectionLabels[sectionType as SectionType] ?? sectionLabels.student)(i18n)
