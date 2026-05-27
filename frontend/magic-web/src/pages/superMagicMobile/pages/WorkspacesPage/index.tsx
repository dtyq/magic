import { observer } from "mobx-react-lite"

import { useSuperMobileShellOutlet } from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"
import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import { WorkspaceListView } from "./components/WorkspaceListView"
import { WorkspaceMoreSheet } from "./components/WorkspaceMoreSheet"
import { CreateWorkspaceSheet } from "./components/CreateWorkspaceSheet"
import { useWorkspacesPage } from "./hooks/useWorkspacesPage"
import { useWorkspaceDeleteConfirm } from "./hooks/useWorkspaceDeleteConfirm"

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
		moreSheetOpen,
		moreSheetWorkspace,
		closeMoreSheet,
		createSheetOpen,
		openCreateSheet,
		closeCreateSheet,
		handleCreateWorkspace,
		handleRenameWorkspace,
		handleDeleteWorkspace,
		handlePinWorkspace,
		handleSelectWorkspace,
		handleOpenSharedWorkspace,
		openMoreSheet,
		handleRefresh,
		hasMore,
		loadMore,
	} = useWorkspacesPage()

	const { requestDeleteWorkspace, deleteConfirmNode } = useWorkspaceDeleteConfirm({
		onDeleteWorkspace: handleDeleteWorkspace,
	})

	return (
		<>
			<WorkspaceListView
				workspaces={filteredWorkspaces}
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
				onPinWorkspace={handlePinWorkspace}
				onDeleteWorkspace={requestDeleteWorkspace}
				onRefresh={handleRefresh}
				loadMore={loadMore}
			/>
			<WorkspaceMoreSheet
				isOpen={moreSheetOpen}
				onClose={closeMoreSheet}
				workspace={moreSheetWorkspace}
				onRename={handleRenameWorkspace}
				onRequestDelete={() => {
					if (moreSheetWorkspace) requestDeleteWorkspace(moreSheetWorkspace)
				}}
			/>
			{deleteConfirmNode}
			<CreateWorkspaceSheet
				isOpen={createSheetOpen}
				onClose={closeCreateSheet}
				onCreate={handleCreateWorkspace}
			/>
		</>
	)
})

function WorkspacesPage() {
	return (
		<MobileOnlyRoute>
			<WorkspacesPagePanel />
		</MobileOnlyRoute>
	)
}

export default WorkspacesPage
