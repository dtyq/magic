import { getTimezones } from "@dtyq/timezone"

const DEFAULT_TIMEZONE = "Asia/Shanghai"

const timezoneCodeSet = new Set(getTimezones({ locale: "en_US" }).map((timezone) => timezone.code))

export function normalizeTimezone(timezone?: string | null) {
	if (!timezone || !timezone.includes("/")) return null

	return timezoneCodeSet.has(timezone) ? timezone : null
}

export function getBrowserTimezone() {
	if (typeof Intl === "undefined") return DEFAULT_TIMEZONE

	const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

	return normalizeTimezone(browserTimezone) ?? DEFAULT_TIMEZONE
}

export function getPreferredTimezone(timezone?: string | null) {
	return normalizeTimezone(timezone) ?? getBrowserTimezone()
}
