import { observer } from "mobx-react-lite"
import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import { WorkspaceMoreSheet } from "@/pages/superMagicMobile/pages/WorkspacesPage/components/WorkspaceMoreSheet"
import { CreateProjectSheet } from "./components/CreateProjectSheet"
import { WorkspaceProjectListView } from "./components/WorkspaceProjectListView"
import { useWorkspacePage } from "./hooks/useWorkspacePage"

/**
 * 工作区页面板只负责装配容器数据和工作区级弹层。
 */
const WorkspacePagePanel = observer(function WorkspacePagePanel() {
	const {
		selectedWorkspace,
		filteredProjects,
		isLoading,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		projectTimeLabels,
		createProjectSheetOpen,
		moreSheetOpen,
		moreSheetWorkspace,
		openCreateProjectSheet,
		closeCreateProjectSheet,
		openMoreSheet,
		closeMoreSheet,
		isProjectEmpty,
		isSearchEmpty,
		handleBack,
		handleRefreshProjects,
		handleCreateProject,
		handleOpenProject,
		handleRenameWorkspace,
		handleDeleteWorkspace,
		handleMoreProjectSwipe,
		handlePinProjectSwipe,
		handleDeleteProjectSwipe,
		projectActionComponents,
		hasMore,
		loadMore,
	} = useWorkspacePage()

	return (
		<>
			<WorkspaceProjectListView
				selectedWorkspace={selectedWorkspace}
				projects={filteredProjects}
				isLoading={isLoading}
				searchValue={searchValue}
				debouncedSearchValue={debouncedSearchValue}
				setSearchValue={setSearchValue}
				projectTimeLabels={projectTimeLabels}
				isProjectEmpty={isProjectEmpty}
				isSearchEmpty={isSearchEmpty}
				hasMore={hasMore}
				onBack={handleBack}
				onOpenMoreSheet={openMoreSheet}
				onRefresh={handleRefreshProjects}
				onOpenCreateProjectSheet={openCreateProjectSheet}
				onOpenProject={handleOpenProject}
				onMoreProject={handleMoreProjectSwipe}
				onPinProject={handlePinProjectSwipe}
				onDeleteProject={handleDeleteProjectSwipe}
				loadMore={loadMore}
			/>
			<CreateProjectSheet
				isOpen={createProjectSheetOpen}
				onClose={closeCreateProjectSheet}
				onCreate={handleCreateProject}
			/>
			{/* 项目操作组件：重命名、移动、删除等弹层由 useProjectListActions 统一管理 */}
			{projectActionComponents}
			<WorkspaceMoreSheet
				isOpen={moreSheetOpen}
				onClose={closeMoreSheet}
				workspace={moreSheetWorkspace}
				onRename={handleRenameWorkspace}
				onDelete={handleDeleteWorkspace}
			/>
		</>
	)
})

function WorkspaceProjectsPage() {
	return (
		<MobileOnlyRoute>
			<WorkspacePagePanel />
		</MobileOnlyRoute>
	)
}

export default WorkspaceProjectsPage
