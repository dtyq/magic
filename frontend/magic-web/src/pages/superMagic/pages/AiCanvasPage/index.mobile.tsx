import { useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"
import AiCanvasCreatePrompt from "./components/AiCanvasCreatePrompt"
import AiCanvasNewCard from "./components/AiCanvasNewCard"
import AiCanvasProjectCard from "./components/AiCanvasProjectCard"
import AiCanvasSearchInput from "./components/AiCanvasSearchInput"
import AiCanvasCardGridSkeleton from "./components/AiCanvasCardGridSkeleton"
import AiCanvasMobileHero from "./components/AiCanvasMobileHero"
import { buildBoardArtworks } from "./utils/boardArtworks"
import { useAiCanvasHome } from "./hooks/useAiCanvasHome"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import { AI_CANVAS_HIDDEN_ACTION_KEYS } from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"

/**
 * AI canvas home on H5, laid out like the micro-app H5 home: the shell header (sidebar toggle
 * and title), then a scrolling middle with a compact first screen and "My canvases" with
 * search, and the create composer docked at the bottom. Data and actions are the desktop page's
 * (useAiCanvasHome), and canvases open in the H5 project page.
 */
function AiCanvasPageMobile() {
	const { t } = useTranslation("aiCanvas")
	const {
		workspace,
		workspaceError,
		loadWorkspace,
		projects,
		actions,
		covers,
		markProjectVisible,
		searchInput,
		setSearchInput,
		listSearchName,
		isSearchPending,
		isInitialLoading,
		listError,
		isListLoading,
		hasMore,
		reloadFirstPage,
		viewportRef,
		loadMoreSentinelRef,
		isCreating,
		handleCreateCanvas,
		openProject,
	} = useAiCanvasHome()
	const boardArtworks = useMemo(() => buildBoardArtworks(), [])
	// H5 card menus use the mobile project action sheet with the same items as the H5 canvas
	// project page (pin, rename, collaboration actions, delete; no "open in new window"); every change
	// reloads the list so pinned order, names and deletions show at once.
	const { openActionsPopup: openProjectActions, projectActionComponents } = useProjectListActions(
		{
			hiddenActionKeys: AI_CANVAS_HIDDEN_ACTION_KEYS,
			onProjectChanged: reloadFirstPage,
		},
	)

	return (
		<div
			className="absolute inset-0 flex h-full min-h-0 w-full flex-col overflow-hidden bg-mobile-background"
			data-testid="ai-canvas-page-mobile"
		>
			<header className="mobile-page-header relative z-20 shrink-0">
				<MobileShellSidebarToggleButton />
				<div className="min-w-0 flex-1 px-2 text-center">
					<p className="truncate text-[17px] font-medium leading-6 text-foreground">
						{t("home.title")}
					</p>
				</div>
				{/* New blank canvas project, same action as the new-canvas card; also balances the
				    sidebar toggle so the title stays centred. */}
				<button
					type="button"
					onClick={handleCreateCanvas}
					disabled={!workspace || isCreating}
					className="mobile-page-header-btn transition-transform active:scale-95 disabled:opacity-50"
					aria-label={t("home.newCanvas")}
					data-testid="ai-canvas-mobile-create-button"
				>
					{isCreating ? (
						<Loader2
							className="size-[22px] animate-spin text-foreground"
							aria-hidden="true"
						/>
					) : (
						<Plus className="size-[22px] text-foreground" aria-hidden="true" />
					)}
				</button>
			</header>

			{workspaceError ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
					<span>{t("home.workspaceFailed")}</span>
					<Button variant="outline" size="sm" onClick={loadWorkspace}>
						{t("home.retry")}
					</Button>
				</div>
			) : (
				<ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
					<div className="flex flex-col gap-3 px-4 pb-4 pt-2">
						{/* Compact first screen; it scrolls away with the list. */}
						<AiCanvasMobileHero artworks={boardArtworks} />
						<AiCanvasSearchInput
							value={searchInput}
							onChange={setSearchInput}
							className="w-full"
						/>
						{isInitialLoading || isSearchPending ? (
							<AiCanvasCardGridSkeleton
								count={4}
								className="grid-cols-2 gap-x-3 gap-y-4"
							/>
						) : listError && projects.length === 0 ? (
							<div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>{t("home.loadFailed")}</span>
								<Button variant="outline" size="sm" onClick={reloadFirstPage}>
									{t("home.retry")}
								</Button>
							</div>
						) : (
							<>
								{/* Two columns fit a phone; the new-canvas card leads, as on desktop. */}
								<div className="grid grid-cols-2 gap-x-3 gap-y-4">
									{listSearchName ? null : (
										<AiCanvasNewCard
											creating={isCreating}
											disabled={!workspace || isCreating}
											onCreate={handleCreateCanvas}
										/>
									)}
									{projects.map((project) => (
										<AiCanvasProjectCard
											key={project.id}
											project={project}
											covers={covers[project.id]}
											onOpen={openProject}
											onRename={actions.handleRenameProject}
											onDelete={actions.handleDeleteProjectConfirm}
											onOpenMenu={openProjectActions}
											onVisible={markProjectVisible}
										/>
									))}
								</div>
								{listSearchName && projects.length === 0 && !isListLoading ? (
									<p
										className="py-10 text-center text-sm text-muted-foreground"
										data-testid="ai-canvas-search-empty"
									>
										{t("home.searchEmpty", { keyword: listSearchName })}
									</p>
								) : null}
								{hasMore ? (
									<div
										ref={loadMoreSentinelRef}
										className="flex h-10 items-center justify-center text-muted-foreground"
									>
										{isListLoading ? (
											<Loader2
												size={16}
												className="animate-spin"
												aria-hidden="true"
											/>
										) : null}
									</div>
								) : null}
							</>
						)}
					</div>
				</ScrollArea>
			)}

			{/* Docked composer, as on the micro-app H5 home; the safe-area padding keeps it above
			    the home indicator. */}
			<div className="relative z-20 shrink-0 bg-mobile-background pb-[env(safe-area-inset-bottom)] pt-1">
				<AiCanvasCreatePrompt workspace={workspace} mobile />
			</div>
			{actions.projectModals}
			{projectActionComponents}
		</div>
	)
}

export default observer(AiCanvasPageMobile)
