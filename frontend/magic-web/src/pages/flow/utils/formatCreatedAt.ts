import dayjs from "@/lib/dayjs"

/** Locale-aware date for flow cards; en uses "March 24, 2026". */
export function formatFlowCardCreatedAt(
	createdAt: string | undefined,
	i18nLanguage: string | undefined,
): string {
	if (!createdAt?.trim()) return ""
	const datePart = createdAt.trim().split(/\s/)[0]
	const d = dayjs(datePart)
	if (!d.isValid()) return createdAt.replace(/-/g, "/")
	if (i18nLanguage?.startsWith("zh")) return d.format("YYYY-MM-DD")
	return d.locale("en").format("MMMM D, YYYY")
}
