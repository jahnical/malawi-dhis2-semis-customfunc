import { applicableSubjectDataElements, gradeForScore, gradeFormula, termRemarkFor, termRemarkFormula } from "./performanceMapping"

const config = {
    subjects: [
        { scoreDataElement: "CHI_S", gradeDataElement: "CHI_G", universal: true },
        { scoreDataElement: "MAT_S", gradeDataElement: "MAT_G" },
        { scoreDataElement: "AGR_S", gradeDataElement: "AGR_G" },
    ],
    gradeMapping: { ranges: [{ optionCode: "A", minScore: 80, maxScore: 100 }, { optionCode: "B", minScore: 50, maxScore: 79 }, { optionCode: "F", minScore: 0, maxScore: 49 }] },
    maxSubjectScore: 100,
    termRemarksMapping: { dataElement: "REM", ranges: [{ optionCode: "Good", minPercentage: 50, maxPercentage: 100 }, { optionCode: "Poor", minPercentage: 0, maxPercentage: 49.99 }] },
    standardGroupMapping: { groups: [{ standards: ["Standard 1", "Standard 2"], subjects: ["MAT_S"] }, { standards: ["Standard 5"], subjects: ["MAT_S", "AGR_S"] }] },
}

test("subjects follow the standard group, plus universal subjects", () => {
    expect([...applicableSubjectDataElements(config, "Standard 1")!].sort()).toEqual(["CHI_G", "CHI_S", "MAT_G", "MAT_S"])
    expect([...applicableSubjectDataElements(config, "Standard 5")!].sort()).toEqual(["AGR_G", "AGR_S", "CHI_G", "CHI_S", "MAT_G", "MAT_S"])
    expect(applicableSubjectDataElements(config, "Standard 8")).toBeNull()
    expect(applicableSubjectDataElements(config, undefined)).toBeNull()
})

test("grade and term remark from scores", () => {
    expect([gradeForScore(config, "85"), gradeForScore(config, 50), gradeForScore(config, 12), gradeForScore(config, ""), gradeForScore(config, "x")]).toEqual(["A", "B", "F", "", ""])
    expect(termRemarkFor(config, ["60", "40"])).toBe("Good")
    expect(termRemarkFor(config, ["60", ""])).toBe("Poor") // empty counts as 0, as on screen
    expect(termRemarkFor(config, ["", ""])).toBe("")
})

test("formulas encode the same ranges", () => {
    expect(gradeFormula(config, "H4")).toBe('IF(TRIM(H4&"")="","",IFERROR(IF(AND(VALUE(H4&"")>=80,VALUE(H4&"")<=100),"A","")&IF(AND(VALUE(H4&"")>=50,VALUE(H4&"")<=79),"B","")&IF(AND(VALUE(H4&"")>=0,VALUE(H4&"")<=49),"F",""),""))')
    const f = termRemarkFormula(config, ["H4", "J4"])
    expect(f.startsWith('IF(((TRIM(H4&"")<>"")+(TRIM(J4&"")<>""))=0,"",')).toBe(true)
    expect(f).toContain('/200*100')
})
