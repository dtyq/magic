import { observer } from "mobx-react-lite"

import { useSuperMobileShellOutlet } from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"
import { WorkspaceListView } from "./components/WorkspaceListView"
import { WorkspaceMoreSheet } from "./components/WorkspaceMoreSheet"
import { CreateWorkspaceSheet } from "./components/CreateWorkspaceSheet"
import { useWorkspacesPage } from "./hooks/useWorkspacesPage"

const WorkspacesPagePanel = observer(function WorkspacesPagePanel() {
	const { openSidebar } = useSuperMobileShellOutlet()
	const {
		isLoading,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		filteredWorkspaces,
		isWorkspaceEmpty,
		isSearchEmpty,
		selectedWorkspace,
		moreSheetOpen,
		moreSheetWorkspace,
		closeMoreSheet,
		createSheetOpen,
		openCreateSheet,
		closeCreateSheet,
		handleCreateWorkspace,
		handleRenameWorkspace,
		handleDeleteWorkspace,
		handleSelectWorkspace,
		handleOpenSharedWorkspace,
		openMoreSheet,
		handleRefresh,
		hasMore,
		loadMore,
	} = useWorkspacesPage()

	return (
		<>
			<WorkspaceListView
				workspaces={filteredWorkspaces}
				selectedWorkspace={selectedWorkspace}
				isLoading={isLoading}
				searchValue={searchValue}
				debouncedSearchValue={debouncedSearchValue}
				isWorkspaceEmpty={isWorkspaceEmpty}
				isSearchEmpty={isSearchEmpty}
				hasMore={hasMore}
				setSearchValue={setSearchValue}
				onSelectWorkspace={handleSelectWorkspace}
				onOpenCreateSheet={openCreateSheet}
				onOpenSharedWorkspace={handleOpenSharedWorkspace}
				onOpenSidebar={openSidebar}
				onMoreWorkspace={openMoreSheet}
				onDeleteWorkspace={(ws) => handleDeleteWorkspace(ws.id)}
				onRefresh={handleRefresh}
				loadMore={loadMore}
			/>
			<WorkspaceMoreSheet
				isOpen={moreSheetOpen}
				onClose={closeMoreSheet}
				workspace={moreSheetWorkspace}
				onRename={handleRenameWorkspace}
				onDelete={handleDeleteWorkspace}
			/>
			<CreateWorkspaceSheet
				isOpen={createSheetOpen}
				onClose={closeCreateSheet}
				onCreate={handleCreateWorkspace}
			/>
		</>
	)
})

export default WorkspacesPagePanel
