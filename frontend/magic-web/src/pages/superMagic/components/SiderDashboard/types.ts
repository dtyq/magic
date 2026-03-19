export interface DashboardItemData {
	id: string
	name: string
	type: "folder" | "dashboard"
	isFavorite?: boolean
	children?: DashboardItemData[]
}
