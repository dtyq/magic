import type { CrewSourceType } from "@/apis/modules/crew"
import { isOfficialPublisherType } from "@/pages/superMagic/pages/CrewMarket/employee-market/components/employee-card-shared"

export function resolveMyCrewCreatedFooterBadgeLabel(
	sourceType: CrewSourceType,
	t: (key: string) => string,
	tCrewCreate: (key: string) => string,
): string {
	switch (sourceType) {
		case "MARKET":
			return t("myCrewPage.sourceStore")
		case "LOCAL_CREATE":
		default:
			return tCrewCreate("status.unpublished")
	}
}

export function formatVersionBadge(version: string | null | undefined): string | null {
	if (!version) return null
	const trimmed = version.trim()
	if (!trimmed) return null
	return trimmed
}

export function resolveMyCrewPublisherLabel(
	publisherType: string | null | undefined,
	publisherName: string | null | undefined,
	t: (key: string) => string,
): string | null {
	const normalizedPublisherName = publisherName?.trim()
	if (normalizedPublisherName && publisherType && !isOfficialPublisherType(publisherType))
		return normalizedPublisherName

	switch (publisherType) {
		case "OFFICIAL":
			return t("skillsLibrary.official")
		case "OFFICIAL_BUILTIN":
			return t("employeeCard.officialBuiltin")
		case "USER":
			return t("employeeCard.publisherUser")
		case "VERIFIED_CREATOR":
			return t("employeeCard.publisherVerified")
		case "PARTNER":
			return t("employeeCard.publisherPartner")
		default:
			return null
	}
}

export function resolveMyCrewHiredActionKind(sourceType: CrewSourceType): "dismiss" | "disable" {
	if (sourceType === "MARKET") return "dismiss"
	return "disable"
}

export function resolveMyCrewDisableActionLabel(
	allowDelete: boolean,
	t: (key: string) => string,
): string {
	if (!allowDelete) return t("myCrewPage.sharedByTeamAction")
	return t("myCrewPage.disable")
}

export function resolveMyCrewDisableActionDisabled(
	allowDelete: boolean,
	enabled: boolean,
): boolean {
	if (!allowDelete) return true
	return !enabled
}
