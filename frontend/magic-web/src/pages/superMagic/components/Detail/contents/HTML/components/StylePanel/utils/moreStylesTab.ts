export function resolveMoreStylesTab(
	cachedTab: string | undefined,
	firstTab: string,
	availableTabs: string[],
) {
	if (cachedTab && availableTabs.includes(cachedTab)) return cachedTab
	return firstTab
}
