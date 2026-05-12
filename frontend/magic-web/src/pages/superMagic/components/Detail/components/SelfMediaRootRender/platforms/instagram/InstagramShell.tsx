import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import type { CardFrameRef } from "../../components/CardFrame"
import ExportPanel from "../../components/ExportPanel"
import ExportPreviewDialog from "../../components/ExportPreviewDialog"
import type { ExportPreviewConfirmArgs } from "../../components/ExportPreviewDialog"
import PostSelector from "../../components/PostSelector"
import ViewTabs from "../../components/ViewTabs"
import { useExportZip } from "../../hooks/useExportZip"
import { useExportProgressToast } from "../../hooks/useExportProgressToast"
import { usePhoneScaling } from "../../hooks/usePhoneScaling"
import { useShellFileHandlers } from "../../hooks/useShellFileHandlers"
import { useShellMountedViews } from "../../hooks/useShellMountedViews"
import { useSelfMediaPlatformChrome } from "../../context/PlatformChromeContext"
import { useSelfMediaStore } from "../../stores"
import type { PlatformComponentProps, SelfMediaPost, SelfMediaView } from "../../types"
import { INSTAGRAM_PHONE_HEIGHT, INSTAGRAM_PHONE_WIDTH } from "./instagramShellConstants"
import { InstagramShellEditViewPanel } from "./InstagramShellEditViewPanel"
import { InstagramShellPhoneViewPanel } from "./InstagramShellPhoneViewPanel"
import { InstagramShellScrollViewPanel } from "./InstagramShellScrollViewPanel"
import { instagramTokens } from "./tokens"

function InstagramShell(props: PlatformComponentProps) {
	const { t } = useTranslation("super")
	const { attachmentList, allowEdit, saveEditContent, selectedProject } = props
	const { setHostElement } = useSelfMediaPlatformChrome()
	const store = useSelfMediaStore()
	const { posts, activePostIndex, activeCardIndex, view, rootLoading } = store
	const activePost = store.activePost ?? undefined

	const cardRefs = useRef<Array<Array<CardFrameRef | null>>>([])
	const { containerRef, scale } = usePhoneScaling<HTMLDivElement>({
		designWidth: INSTAGRAM_PHONE_WIDTH + 28,
		designHeight: INSTAGRAM_PHONE_HEIGHT + 28,
	})
	const { progress, exportZip } = useExportZip()
	const [exportDialogOpen, setExportDialogOpen] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const editViewChangeHandlerRef = useRef<((nextView: SelfMediaView) => void) | null>(null)
	const editPostChangeHandlerRef = useRef<((nextPostIndex: number) => void) | null>(null)
	const shellDataReloadWithGuardRef = useRef<(() => void) | null>(null)

	const isScrollView = view === "scroll"
	const isEditView = view === "edit"
	const shouldShowFooter = view !== "detail" && view !== "edit"
	const [isCardEditing, setIsCardEditing] = useState(false)

	const { shouldRenderFeed, shouldRenderDetail, shouldRenderScroll, shouldRenderEdit } =
		useShellMountedViews(view)

	const { handleAddFileToCurrentChat, handleAddActivePostDirectoryToCurrentChat } =
		useShellFileHandlers({ attachmentList, activePost })

	useExportProgressToast(progress, "instagram-shell-export")

	useEffect(() => {
		if (view !== "edit") setIsCardEditing(false)
	}, [view])

	// Redirect away from edit view when editing is not allowed
	useEffect(() => {
		if (allowEdit === false && view === "edit") {
			store.setView("detail")
		}
	}, [allowEdit, view, store])

	const headerLabels = {
		feed: t("detail.selfMedia.platform.instagram.tabs.feed"),
		detail: t("detail.selfMedia.platform.instagram.tabs.detail"),
		scroll: t("detail.selfMedia.platform.instagram.tabs.scroll"),
		edit: t("detail.selfMedia.platform.instagram.tabs.edit"),
	}

	// Hide edit tab when editing is not allowed (read-only / share mode)
	const visibleTabs = useMemo<SelfMediaView[]>(
		() =>
			allowEdit === false
				? ["feed", "detail", "scroll"]
				: ["feed", "detail", "scroll", "edit"],
		[allowEdit],
	)
	const footerLabels = {
		home: t("detail.selfMedia.platform.instagram.footer.home"),
		search: t("detail.selfMedia.platform.instagram.footer.search"),
		create: t("detail.selfMedia.platform.instagram.footer.create"),
		reels: t("detail.selfMedia.platform.instagram.footer.reels"),
		profile: t("detail.selfMedia.platform.instagram.footer.profile"),
	}

	const handleOpenExportDialog = () => {
		setExportDialogOpen(true)
	}

	const handleBackHome = useCallback(() => {
		store.setView("feed")
	}, [store])

	const handleGuardedViewChange = useCallback(
		(nextView: SelfMediaView) => {
			if (view === "edit" && isCardEditing && nextView !== "edit") {
				editViewChangeHandlerRef.current?.(nextView)
				return
			}
			store.setView(nextView)
		},
		[view, isCardEditing, store],
	)

	const handleEditingStateChange = useCallback((editing: boolean) => {
		setIsCardEditing(editing)
	}, [])

	const handleRequestViewChangeReady = useCallback(
		(handler: ((nextView: SelfMediaView) => void) | null) => {
			editViewChangeHandlerRef.current = handler
		},
		[],
	)

	const handleRequestPostChangeReady = useCallback(
		(handler: ((nextPostIndex: number) => void) | null) => {
			editPostChangeHandlerRef.current = handler
		},
		[],
	)

	const handleDetailCardChange = useCallback(
		(nextCardIndex: number) => {
			if (view !== "detail") return
			store.setActiveCardIndex(nextCardIndex)
		},
		[store, view],
	)

	const handleGoToDetailEdit = useCallback(() => {
		store.setActiveCardIndex(activeCardIndex)
		store.setView("edit")
	}, [store, activeCardIndex])

	const handleSelectPostKeepingView = useCallback(
		(nextPostIndex: number) => {
			if (view === "edit" && isCardEditing) {
				editPostChangeHandlerRef.current?.(nextPostIndex)
				return
			}
			store.setActivePostIndex(nextPostIndex)
			store.setView(view)
			void store.ensurePostLoaded(nextPostIndex)
		},
		[view, isCardEditing, store],
	)

	const handleFeedSelectPost = useCallback(
		(idx: number) => {
			store.setActivePostIndex(idx)
			store.setView("detail")
		},
		[store],
	)

	const handleEnsurePostLoaded = useCallback(
		(idx: number) => store.ensurePostLoaded(idx),
		[store],
	)

	const handleAddDetailCardToCurrentChat = useCallback(
		(cardIndex: number) => {
			handleAddFileToCurrentChat(activePost?.cards[cardIndex]?.fileId)
		},
		[activePost, handleAddFileToCurrentChat],
	)

	const handleAddScrollCardToCurrentChat = useCallback(
		(cardIndex: number) => {
			handleAddFileToCurrentChat(activePost?.cards[cardIndex]?.fileId)
		},
		[activePost, handleAddFileToCurrentChat],
	)

	const handleAddFeedCardToCurrentChat = useCallback(
		(postIndex: number) => {
			handleAddFileToCurrentChat(posts[postIndex]?.cards[0]?.fileId)
		},
		[handleAddFileToCurrentChat, posts],
	)

	const handleShellDataReload = useCallback(() => {
		void store.init({ preserveNavigation: true })
	}, [store])

	const handleClickToolbarRefresh = useCallback(() => {
		const run = shellDataReloadWithGuardRef.current
		if (run) {
			run()
			return
		}
		handleShellDataReload()
	}, [handleShellDataReload])

	const handleRequestShellDataReloadReady = useCallback((handler: (() => void) | null) => {
		shellDataReloadWithGuardRef.current = handler
	}, [])

	const handleConfirmExport = async ({
		postIndex,
		cardIndexes,
		pixelRatio,
	}: ExportPreviewConfirmArgs) => {
		if (!cardIndexes.length) return
		setIsExporting(true)
		try {
			const exportPosts = await store.ensureAllPostsLoaded()
			const target = exportPosts[postIndex]
			if (!target) return
			const subsetCards = cardIndexes
				.map((cardIndex) => target.cards[cardIndex])
				.filter((card): card is (typeof target.cards)[number] => Boolean(card))
			if (!subsetCards.length) return
			const subset: SelfMediaPost = {
				meta: target.meta,
				cards: subsetCards,
			}
			await exportZip({
				posts: [subset],
				zipName: target.meta.title || target.meta.id,
				pixelRatio,
				getCardRef: (_p, c) => {
					const originalCardIndex = cardIndexes[c]
					return cardRefs.current[postIndex]?.[originalCardIndex] || null
				},
			})
			setExportDialogOpen(false)
		} finally {
			setIsExporting(false)
		}
	}

	const phoneShellVisible = !isScrollView && !isEditView

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ backgroundColor: instagramTokens.chromeBg }}
		>
			<div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-2">
				<div
					ref={setHostElement}
					className="flex min-w-0 shrink-0 items-center gap-2 [&:empty]:hidden"
					data-testid="self-media-platform-switcher-host"
				/>
				<PostSelector
					posts={posts}
					activeIndex={activePostIndex}
					onChange={handleSelectPostKeepingView}
					className="flex-1"
				/>
				<ViewTabs
					value={view}
					onChange={handleGuardedViewChange}
					labels={headerLabels}
					order={visibleTabs}
				/>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							disabled={rootLoading}
							onClick={handleClickToolbarRefresh}
							data-testid="instagram-shell-refresh-post-button"
							aria-label={t("detail.selfMedia.refreshAllData")}
						>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("detail.selfMedia.refreshAllData")}</TooltipContent>
				</Tooltip>
				<ExportPanel
					onOpen={handleOpenExportDialog}
					label={t("detail.selfMedia.export.action")}
					disabled={isExporting || posts.length === 0}
				/>
			</div>
			<ExportPreviewDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				posts={posts}
				initialPostIndex={activePostIndex}
				attachmentList={attachmentList}
				onSyncActivePost={handleSelectPostKeepingView}
				onConfirm={handleConfirmExport}
				isExporting={isExporting}
			/>
			<div ref={containerRef} className="relative flex-1 overflow-hidden">
				<InstagramShellEditViewPanel
					shouldRender={shouldRenderEdit}
					isActive={isEditView}
					attachmentList={attachmentList}
					saveEditContent={saveEditContent}
					selectedProject={selectedProject}
					onEditingStateChange={handleEditingStateChange}
					onRequestViewChangeReady={handleRequestViewChangeReady}
					onRequestPostChangeReady={handleRequestPostChangeReady}
					onAddCardToCurrentChat={handleAddDetailCardToCurrentChat}
					onShellDataReload={handleShellDataReload}
					onRequestShellDataReloadReady={handleRequestShellDataReloadReady}
				/>
				<InstagramShellScrollViewPanel
					shouldRender={shouldRenderScroll}
					isActive={isScrollView}
					attachmentList={attachmentList}
					allowEdit={allowEdit}
					cardRefs={cardRefs}
					onAddCardToCurrentChat={handleAddScrollCardToCurrentChat}
					onAddActivePostDirectoryToCurrentChat={
						handleAddActivePostDirectoryToCurrentChat
					}
				/>
				<InstagramShellPhoneViewPanel
					visible={phoneShellVisible}
					scale={scale}
					posts={posts}
					activePostIndex={activePostIndex}
					shouldRenderFeed={shouldRenderFeed}
					shouldRenderDetail={shouldRenderDetail}
					shouldShowFooter={shouldShowFooter}
					attachmentList={attachmentList}
					allowEdit={allowEdit}
					cardRefs={cardRefs}
					footerLabels={footerLabels}
					onBackHome={handleBackHome}
					onSelectFeedPost={handleFeedSelectPost}
					onEnsurePostLoaded={handleEnsurePostLoaded}
					onChangeDetailCard={handleDetailCardChange}
					onAddFeedCardToCurrentChat={handleAddFeedCardToCurrentChat}
					onAddDetailCardToCurrentChat={handleAddDetailCardToCurrentChat}
					onAddActivePostDirectoryToCurrentChat={
						handleAddActivePostDirectoryToCurrentChat
					}
					onGoToEdit={handleGoToDetailEdit}
				/>
			</div>
		</div>
	)
}

export default observer(InstagramShell)
