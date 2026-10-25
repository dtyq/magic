export function shouldCollapseStylesOnBlur(
	previousSelector: string | undefined,
	nextSelector: string | undefined,
): boolean {
	return Boolean(previousSelector) && !nextSelector
}
