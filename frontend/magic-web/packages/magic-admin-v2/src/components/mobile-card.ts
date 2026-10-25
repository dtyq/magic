/**
 * Shared visual tokens for mobile management cards.
 * Keep card geometry, density, and separators consistent across feature pages.
 */
export const mobileCardTokens = {
	list: "grid gap-3",
	card: "gap-0 overflow-hidden rounded-lg border border-border/70 bg-card py-0 text-card-foreground shadow-none",
	header: "flex min-w-0 items-start gap-3 px-4 py-3",
	content: "grid grid-cols-2 gap-x-4 gap-y-3 border-t px-4 py-3",
	groupHeader: "flex min-w-0 items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3",
	item: "space-y-3 px-4 py-4",
	label: "mb-1 text-xs text-muted-foreground",
	value: "min-w-0 break-words text-sm",
	actions: "flex justify-end border-t px-3 py-1.5",
	actionButton: "min-h-9 gap-1 px-2 text-muted-foreground",
} as const
