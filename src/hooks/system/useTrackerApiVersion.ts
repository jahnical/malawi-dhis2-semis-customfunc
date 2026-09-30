import { useConfig } from "@dhis2/app-runtime";
import { getSysInfo } from "./getSysInfo";

type Version = { major?: number, minor?: number } | undefined

// DHIS2 reports "2.43.0" today, but newer releases may drop the leading "2." ("43.0.0").
function versionFromParts(major?: number, minor?: number): number | undefined {
    if (Number.isFinite(major) && (major as number) > 2) return major
    if (Number.isFinite(minor)) return minor
    return undefined
}

export function resolveTrackerApiVersion({ serverVersion, platformVersion, apiVersion }:
    { serverVersion?: Version, platformVersion?: string, apiVersion?: number }): number {
    const [major, minor] = (platformVersion ?? "").split(".").map((part) => Number.parseInt(part))

    return versionFromParts(serverVersion?.major, serverVersion?.minor)
        ?? versionFromParts(major, minor)
        ?? apiVersion
        ?? 40
}

// The server's DHIS2 version (40, 41, 43, ...), used to pick the tracker API dialect.
export function useTrackerApiVersion(): number {
    const { serverVersion, apiVersion } = useConfig()
    const { platformVersion } = getSysInfo()

    return resolveTrackerApiVersion({ serverVersion, platformVersion, apiVersion })
}
