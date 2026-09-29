import { getSectionProfile, type SectionProfile } from "dhis2-semis-types";
import { useUrlParams } from "./useQueryParams";

const useSectionProfile = (): SectionProfile => {
    const { urlParameters } = useUrlParams()
    return getSectionProfile(urlParameters.sectionType)
}
export default useSectionProfile;
