import { lazy, Suspense, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { LayoutGrid, Loader2, Plus } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useIsMobile } from "@/hooks/useIsMobile"
import { preloadTopicPage } from "@/pages/superMagic/pages/TopicPage/utils"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import AiCanvasCreatePrompt from "./components/AiCanvasCreatePrompt"
import AiCanvasHero from "./components/AiCanvasHero"
import AiCanvasNewCard from "./components/AiCanvasNewCard"
import AiCanvasProjectCard from "./components/AiCanvasProjectCard"
import AiCanvasSearchInput from "./components/AiCanvasSearchInput"
import AiCanvasCardGridSkeleton from "./components/AiCanvasCardGridSkeleton"
import { useAiCanvasHome } from "./hooks/useAiCanvasHome"
import { buildBoardArtworks } from "./utils/boardArtworks"

const AiCanvasPageMobile = lazy(() => import("./index.mobile"))

/**
 * AI canvas home (desktop): the hero with the create composer, then "My canvases". Data and
 * actions come from useAiCanvasHome, shared with the H5 page.
 */
function AiCanvasPageDesktop() {
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
		handleTogglePin,
		cardMenuActions,
		isCreating,
		handleCreateCanvas,
		openProject,
	} = useAiCanvasHome()
	// Static: the hero board only shows the built-in showcase (placeholders until it exists).
	const boardArtworks = useMemo(() => buildBoardArtworks(), [])

	if (workspaceError) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
				<span>{t("home.workspaceFailed")}</span>
				<Button variant="outline" size="sm" onClick={loadWorkspace}>
					{t("home.retry")}
				</Button>
			</div>
		)
	}

	return (
		// Same rounded page frame as the micro-app home: an 8px inset card that fills the main area,
		// with the hero and the sections below sharing one surface.
		<ScrollArea
			className="m-2 h-[calc(100%_-_16px)] w-[calc(100%_-_16px)] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm"
			viewportRef={viewportRef}
			data-testid="ai-canvas-page"
		>
			{/* The hero is full-bleed; the sections below keep a centered reading width. */}
			<div className="flex w-full flex-col">
				<AiCanvasHero
					artworks={boardArtworks}
					footer={
						<div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
							<span>{t("home.or")}</span>
							<Button
								variant="outline"
								size="sm"
								className="rounded-full bg-background/80 backdrop-blur"
								onClick={handleCreateCanvas}
								disabled={!workspace || isCreating}
								data-testid="ai-canvas-create-button"
							>
								{isCreating ? (
									<Loader2
										size={16}
										className="animate-spin"
										aria-hidden="true"
									/>
								) : (
									<Plus size={16} aria-hidden="true" />
								)}
								{t("home.newBlankCanvas")}
							</Button>
						</div>
					}
				>
					<AiCanvasCreatePrompt workspace={workspace} />
				</AiCanvasHero>

				<div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-6 pb-16 pt-8">
					<section className="flex flex-col gap-4">
						<div className="flex items-end justify-between gap-3">
							<div className="flex min-w-0 flex-col gap-1">
								<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
									<LayoutGrid size={16} aria-hidden="true" />
									{t("home.myCanvases")}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t("home.myCanvasesSubtitle")}
								</p>
							</div>
							<AiCanvasSearchInput value={searchInput} onChange={setSearchInput} />
						</div>
						{/* First load and searches share the card-shaped skeleton. */}
						{isInitialLoading ? (
							<AiCanvasCardGridSkeleton />
						) : listError && projects.length === 0 ? (
							<div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>{t("home.loadFailed")}</span>
								<Button variant="outline" size="sm" onClick={reloadFirstPage}>
									{t("home.retry")}
								</Button>
							</div>
						) : isSearchPending ? (
							<AiCanvasCardGridSkeleton />
						) : (
							// Keyed by the keyword: each settled search fades in as a whole.
							<motion.div
								key={listSearchName}
								className="flex flex-col gap-4"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.25, ease: "easeOut" }}
							>
								<div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
									{/* First when browsing, so it also serves as the empty state; search
									    results show only matching canvases. */}
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
											onOpenInNewWindow={openProjectInNewTab}
											onTogglePin={handleTogglePin}
											menuActions={cardMenuActions}
											onHover={preloadTopicPage}
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
								{/* Scrolling near the end loads the next page; the spinner shows while it loads. */}
								{hasMore ? (
									<div
										ref={loadMoreSentinelRef}
										className="flex h-10 items-center justify-center text-muted-foreground"
										data-testid="ai-canvas-load-more-sentinel"
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
							</motion.div>
						)}
					</section>
				</div>
			</div>
			{actions.projectModals}
		</ScrollArea>
	)
}

const AiCanvasPageDesktopObserver = observer(AiCanvasPageDesktop)

/** Picks the desktop page or the H5 page, like the micro-app home. */
export default function AiCanvasPage() {
	const isMobile = useIsMobile()
	if (isMobile) {
		return (
			<Suspense
				fallback={
					<div className="flex h-full w-full items-center justify-center bg-mobile-background">
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
					</div>
				}
			>
				<AiCanvasPageMobile />
			</Suspense>
		)
	}
	return <AiCanvasPageDesktopObserver />
}
