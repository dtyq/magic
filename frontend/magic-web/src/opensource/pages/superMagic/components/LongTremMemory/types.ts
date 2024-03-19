import type { NavigateToStateParams } from "@/opensource/pages/superMagic/services/routeManageService"
import type { LongMemory } from "@/opensource/types/longMemory"

/** 页面 */
export enum LongTremMemoryPage {
	/** 列表 */
	List = "list",
	/** 建议 */
	Suggestion = "suggestion",
	/** 创建/编辑 */
	CreateOrEdit = "createOrEdit",
}

export enum MemoryTypeTab {
	GlobalMemory = "globalMemory",
	ProjectMemory = "projectMemory",
}

export interface PageProps {
	editMemory?: LongMemory.Memory
	setPage: (page: LongTremMemoryPage) => void
	setEditMemory: (memory: LongMemory.Memory | undefined) => void
	setBreadcrumbList: (breadcrumbList: string[]) => void
	onClose: () => void
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
}
