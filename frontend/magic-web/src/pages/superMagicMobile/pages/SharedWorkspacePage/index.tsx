import { observer } from "mobx-react-lite"

import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import { SharedProjectsFilterSheet } from "./components/SharedProjectsFilterSheet"
import { SharedProjectsView } from "./components/SharedProjectsView"
import { useSharedWorkspacePage } from "./hooks/useSharedWorkspacePage"

/**
 * 共享工作区面板负责装配数据 Hook 与筛选 Sheet，视图层保持纯展示。
 */
const SharedWorkspacePagePanel = observer(function SharedWorkspacePagePanel() {
	const {
		tab,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		projects,
		isLoading,
		isEmpty,
		isSearchEmpty,
		isFilterOpen,
		canShowFilter,
		selectedCreatorIds,
		availableCreators,
		activeFilterCount,
		closeFilterSheet,
		openFilterSheet,
		handleBack,
		handleTabChange,
		handleCreatorToggle,
		handleCreatorRemove,
		handleResetFilter,
		handleOpenProject,
		loadProjects,
		hasMore,
		loadMore,
	} = useSharedWorkspacePage()

	return (
		<>
			<SharedProjectsView
				tab={tab}
				projects={projects}
				isLoading={isLoading}
				isEmpty={isEmpty}
				isSearchEmpty={isSearchEmpty}
				searchValue={searchValue}
				debouncedSearchValue={debouncedSearchValue}
				canShowFilter={canShowFilter}
				activeFilterCount={activeFilterCount}
				hasMore={hasMore}
				onBack={handleBack}
				onTabChange={handleTabChange}
				onOpenFilter={openFilterSheet}
				onSearchChange={setSearchValue}
				onOpenProject={handleOpenProject}
				onRefresh={loadProjects}
				loadMore={loadMore}
			/>
			<SharedProjectsFilterSheet
				isOpen={isFilterOpen}
				tab={tab}
				selectedCreatorIds={selectedCreatorIds}
				availableCreators={availableCreators}
				activeFilterCount={activeFilterCount}
				onClose={closeFilterSheet}
				onReset={handleResetFilter}
				onCreatorToggle={handleCreatorToggle}
				onCreatorRemove={handleCreatorRemove}
			/>
		</>
	)
})

function SharedWorkspacePage() {
	return (
		<MobileOnlyRoute>
			<SharedWorkspacePagePanel />
		</MobileOnlyRoute>
	)
}

export default SharedWorkspacePage
