import { SuperMagicApi } from "@/apis"
import type { CollaborationProjectListItem } from "../../../pages/Workspace/types"
import { isSharedWorkspaceProject } from "../resourceProjectTypes"

const PAGE_SIZE = 100

/** 共享来源没有模式筛选参数，须读完原始分页，才能得到完整列表和准确数量。 */
export async function loadSharedWorkspaceProjects({
	signal,
}: { signal?: AbortSignal } = {}): Promise<CollaborationProjectListItem[]> {
	const projects = new Map<string, CollaborationProjectListItem>()
	let received = 0
	for (let page = 1; ; page += 1) {
		signal?.throwIfAborted()
		const response = await SuperMagicApi.getCollaborationProjects(
			{ page, page_size: PAGE_SIZE },
			{ signal },
		)
		signal?.throwIfAborted()
		const items = response.list || []
		received += items.length
		for (const project of items) {
			if (isSharedWorkspaceProject(project)) projects.set(project.id, project)
		}
		// 用过滤前的条数推进；整页都是员工项目也不能提前停止。
		if (items.length === 0 || received >= response.total) break
	}
	return Array.from(projects.values())
}
