/** Shared employee-market card helpers (not UI). */

interface StoreAgentActionState {
	isAdded: boolean
	allowDelete: boolean
}

export function isOfficialPublisherType(publisherType: string): boolean {
	return publisherType === "OFFICIAL" || publisherType === "OFFICIAL_BUILTIN"
}

export function isOfficialBuiltinPublisherType(publisherType: string): boolean {
	return publisherType === "OFFICIAL_BUILTIN"
}

export function isSelfCreatedStoreAgent({ isAdded, allowDelete }: StoreAgentActionState): boolean {
	return isAdded && !allowDelete
}

/** Label for hire/dismiss on store agent cards and market detail dialog. */
export function resolveEmployeeMarketPrimaryActionLabel(
	employee: StoreAgentActionState & { publisherType: string },
	t: (key: string) => string,
): string {
	if (isOfficialBuiltinPublisherType(employee.publisherType))
		return t("employeeCard.officialBuiltin")
	if (isSelfCreatedStoreAgent(employee)) return t("employeeCard.createdByYouNoHiringNeeded")
	if (employee.allowDelete) return t("dismiss")
	return t("hire")
}

/** Dismiss: only self-created; hire: self-created or official builtin. */
export function isEmployeeMarketPrimaryActionDisabled(
	employee: StoreAgentActionState & { publisherType: string },
): boolean {
	if (employee.allowDelete) return isSelfCreatedStoreAgent(employee)
	return (
		isSelfCreatedStoreAgent(employee) || isOfficialBuiltinPublisherType(employee.publisherType)
	)
}

export function resolvePublisherLabel(
	publisherType: string,
	publisherName: string | null | undefined,
	t: (key: string) => string,
): string {
	const normalizedPublisherName = publisherName?.trim()
	if (normalizedPublisherName && !isOfficialPublisherType(publisherType))
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
			return t("employeeCard.publisherDefault")
	}
}

export function formatPublisherHandle(label: string): string {
	const s = label.trim()
	if (!s) return "@"
	const withoutAt = s.replace(/^@+/, "")
	return `@${withoutAt}`
}

export function formatVersionBadge(version: string | null | undefined): string | null {
	if (!version) return null
	const trimmed = version.trim()
	if (!trimmed) return null
	return trimmed
}
