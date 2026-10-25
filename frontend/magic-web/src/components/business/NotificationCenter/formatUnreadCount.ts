export function formatUnreadCount(count: number): string | null {
	if (count <= 0) return null
	if (count > 99) return "99+"
	return String(count)
}
