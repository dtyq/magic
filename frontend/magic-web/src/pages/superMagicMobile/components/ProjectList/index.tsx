import { useState } from "react"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { MobileResourceListSkeletonList } from "@/pages/superMagicMobile/components/skeletons"
import ProjectItem from "./components/ProjectItem"
interface ProjectListProps {
	projects: ProjectListItem[]
	isLoading: boolean
	projectTimeLabels?: Record<string, string>
	onOpen: (project: ProjectListItem) => void
	onMore: (project: ProjectListItem) => void
	onPin: (project: ProjectListItem) => void
	onDelete: (project: ProjectListItem) => void
}

/**
 * 项目列表维护左滑展开互斥状态（openItemId），业务逻辑全部由父层回调处理。
 */
function ProjectList({
	projects,
	isLoading,
	projectTimeLabels = {},
	onOpen,
	onMore,
	onPin,
	onDelete,
}: ProjectListProps) {
	/** 同时只允许一行处于左滑展开状态 */
	const [openItemId, setOpenItemId] = useState<string | null>(null)

	/** 仅首屏无数据时展示骨架，操作后静默刷新不替换整表 */
	const showInitialLoading = isLoading && projects.length === 0

	return (
		<div className="flex flex-col gap-1" data-testid="workspace-project-list">
			{showInitialLoading ? (
				<MobileResourceListSkeletonList testId="workspace-project-list-loading" />
			) : (
				projects.map((project) => (
					<ProjectItem
						key={project.id}
						project={project}
						onOpen={onOpen}
						updatedAtLabel={projectTimeLabels[project.id]}
						isSwipeOpen={openItemId === project.id}
						onSwipeOpen={() => setOpenItemId(project.id)}
						onSwipeClose={() => setOpenItemId(null)}
						onMore={onMore}
						onPin={onPin}
						onDelete={onDelete}
					/>
				))
			)}
		</div>
	)
}

export default ProjectList
