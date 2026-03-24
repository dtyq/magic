const DEFAULT_FIRST_PUBLISH_VERSION = "v1.0.0"

export function resolveNextCrewPublishVersion(version?: string | null) {
	const trimmed = version?.trim()
	if (!trimmed) return DEFAULT_FIRST_PUBLISH_VERSION

	const normalized = trimmed.replace(/^v/i, "")
	const segments = normalized.split(".")
	if (!segments.every((segment) => /^\d+$/.test(segment))) {
		return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`
	}

	const nextSegments = [...segments]
	const lastIndex = nextSegments.length - 1
	nextSegments[lastIndex] = String(Number(nextSegments[lastIndex]) + 1)

	return `v${nextSegments.join(".")}`
}
