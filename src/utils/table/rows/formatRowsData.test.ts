import { formatRowsData } from "./formatRowsData";

test("rows carry the registration event's org unit, not the enrollment's", () => {
    const rows = formatRowsData({
        isBasicStage: true,
        registrationInstances: [{ event: "R1", trackedEntity: "T1", enrollment: "E1", orgUnit: "S2", dataValues: [] }],
        teiInstances: [{
            trackedEntity: "T1", attributes: [], createdAt: "", programOwners: [{ orgUnit: "S2" }],
            enrollments: [{ enrollment: "E1", orgUnit: "S1", program: "P1", status: "ACTIVE" }],
        }],
    })
    expect(rows[0]).toMatchObject({ orgUnitId: "S2", enrollmentId: "E1", programId: "P1", status: "ACTIVE" })
})
