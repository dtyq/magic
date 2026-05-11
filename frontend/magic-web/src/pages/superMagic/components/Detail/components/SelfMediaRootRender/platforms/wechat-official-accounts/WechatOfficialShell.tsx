import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import PostSelector from "../../components/PostSelector"
import ViewTabs from "../../components/ViewTabs"
import { useSelfMediaPlatformChrome } from "../../context/PlatformChromeContext"
import { useSelfMediaStore } from "../../stores"
import type { PlatformComponentProps, SelfMediaView } from "../../types"
import WechatArticleView from "./article"
import WechatCodeView from "./code"
import { WechatCoverPhonePanel } from "./WechatCoverPhonePanel"
import WechatEditView from "./edit"
import { WechatOfficialContentGate } from "./WechatOfficialContentGate"
import { wechatOfficialTokens } from "./tokens"

const TAB_ORDER: SelfMediaView[] = ["feed", "detail", "edit", "code"]

function WechatOfficialShell(props: PlatformComponentProps) {
	const { t } = useTranslation("super")
	const { attachmentList, allowEdit, saveEditContent, selectedProject } = props
	const { setHostElement } = useSelfMediaPlatformChrome()
	const store = useSelfMediaStore()
	const { posts, loading, error, activePostIndex, view, rootLoading } = store

	const activePost = store.activePost ?? undefined
	const onChangeView = useCallback((nextView: SelfMediaView) => store.setView(nextView), [store])
	const onChangePost = useCallback(
		(nextIndex: number) => store.setActivePostIndex(nextIndex),
		[store],
	)
	const onEnsurePostLoaded = useCallback((idx: number) => store.ensurePostLoaded(idx), [store])
	const isEditView = view === "edit"

	// Hide edit/code tabs when editing is not allowed (read-only / share mode)
	const visibleTabs = useMemo(
		() =>
			allowEdit === false ? TAB_ORDER.filter((v) => v !== "edit" && v !== "code") : TAB_ORDER,
		[allowEdit],
	)

	// Promote default "detail" to "feed" on first mount so users land on the cover list
	const promotedDefaultRef = useRef(false)
	useEffect(() => {
		if (promotedDefaultRef.current) return
		promotedDefaultRef.current = true
		if (view === "detail") {
			onChangeView("feed")
		}
	}, [view, onChangeView])

	// Normalize unsupported views (scroll) to the detail slot so switching from
	// another platform never leaves the shell with no visible tab.
	useEffect(() => {
		if (!TAB_ORDER.includes(view)) {
			onChangeView("detail")
		}
	}, [view, onChangeView])

	// Redirect away from edit/code views when editing is not allowed
	useEffect(() => {
		if (allowEdit === false && (view === "edit" || view === "code")) {
			onChangeView("detail")
		}
	}, [allowEdit, view, onChangeView])

	const [isArticleEditing, setIsArticleEditing] = useState(false)
	const editViewChangeHandlerRef = useRef<((nextView: SelfMediaView) => void) | null>(null)
	const editPostChangeHandlerRef = useRef<((nextPostIndex: number) => void) | null>(null)

	const [isCodeEditing, setIsCodeEditing] = useState(false)
	const codeViewChangeHandlerRef = useRef<((nextView: SelfMediaView) => void) | null>(null)
	const codePostChangeHandlerRef = useRef<((nextPostIndex: number) => void) | null>(null)

	const [mountedViews, setMountedViews] = useState(() => ({
		feed: view === "feed",
		detail: view === "detail",
		edit: view === "edit",
		code: view === "code",
	}))

	useEffect(() => {
		if (view === "scroll") return
		setMountedViews((prev) => (prev[view] ? prev : { ...prev, [view]: true }))
	}, [view])

	useEffect(() => {
		if (view !== "edit") setIsArticleEditing(false)
	}, [view])

	useEffect(() => {
		if (view !== "code") setIsCodeEditing(false)
	}, [view])

	const shouldRenderFeed = mountedViews.feed || view === "feed"
	const shouldRenderDetail = mountedViews.detail || view === "detail"
	const shouldRenderEdit = mountedViews.edit || view === "edit"
	const shouldRenderCode = mountedViews.code || view === "code"

	const tabLabels = useMemo(
		() => ({
			feed: t("detail.selfMedia.platform.wechat-official-accounts.tabs.cover"),
			detail: t("detail.selfMedia.platform.wechat-official-accounts.tabs.article"),
			edit: t("detail.selfMedia.platform.wechat-official-accounts.tabs.edit"),
			code: t("detail.selfMedia.platform.wechat-official-accounts.tabs.code"),
		}),
		[t],
	)

	const handleEditingStateChange = useCallback((editing: boolean) => {
		setIsArticleEditing(editing)
	}, [])

	const handleCodeEditingStateChange = useCallback((editing: boolean) => {
		setIsCodeEditing(editing)
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

	const handleCodeRequestViewChangeReady = useCallback(
		(handler: ((nextView: SelfMediaView) => void) | null) => {
			codeViewChangeHandlerRef.current = handler
		},
		[],
	)

	const handleCodeRequestPostChangeReady = useCallback(
		(handler: ((nextPostIndex: number) => void) | null) => {
			codePostChangeHandlerRef.current = handler
		},
		[],
	)

	const handleGuardedViewChange = useCallback(
		(nextView: SelfMediaView) => {
			if (view === "edit" && isArticleEditing && nextView !== "edit") {
				editViewChangeHandlerRef.current?.(nextView)
				return
			}
			if (view === "code" && isCodeEditing && nextView !== "code") {
				codeViewChangeHandlerRef.current?.(nextView)
				return
			}
			onChangeView(nextView)
		},
		[view, isArticleEditing, isCodeEditing, onChangeView],
	)

	const handleSelectPostKeepingView = useCallback(
		(nextPostIndex: number) => {
			if (view === "edit" && isArticleEditing) {
				editPostChangeHandlerRef.current?.(nextPostIndex)
				return
			}
			if (view === "code" && isCodeEditing) {
				codePostChangeHandlerRef.current?.(nextPostIndex)
				return
			}
			onChangePost(nextPostIndex)
			onChangeView(view)
			void store.ensurePostLoaded(nextPostIndex)
		},
		[view, isArticleEditing, isCodeEditing, onChangePost, onChangeView, store],
	)

	const handleFeedSelectPost = useCallback(
		(idx: number) => {
			onChangePost(idx)
			onChangeView("detail")
		},
		[onChangePost, onChangeView],
	)

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ background: wechatOfficialTokens.background }}
			data-testid="wechat-official-shell"
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
				{isEditView ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								disabled={rootLoading}
								onClick={() => void store.init()}
								data-testid="wechat-shell-refresh-post-button"
								aria-label={t("detail.selfMedia.refreshAllData")}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("detail.selfMedia.refreshAllData")}</TooltipContent>
					</Tooltip>
				) : null}
				<ViewTabs
					value={view}
					onChange={handleGuardedViewChange}
					labels={tabLabels}
					order={visibleTabs}
				/>
			</div>

			<div className="relative flex-1 overflow-hidden">
				{shouldRenderFeed ? (
					<WechatCoverPhonePanel
						visible={view === "feed"}
						loading={loading}
						error={error}
						posts={posts}
						attachmentList={attachmentList}
						onSelectPost={handleFeedSelectPost}
						onEnsurePostLoaded={onEnsurePostLoaded}
					/>
				) : null}

				{shouldRenderDetail ? (
					<div
						className={
							view === "detail" ? "absolute inset-0 block" : "absolute inset-0 hidden"
						}
						aria-hidden={view !== "detail"}
					>
						<WechatOfficialContentGate
							loading={loading}
							error={error}
							hasPost={Boolean(activePost)}
						>
							{activePost ? (
								<WechatArticleView
									post={activePost}
									attachmentList={attachmentList}
									selectedProject={selectedProject}
								/>
							) : null}
						</WechatOfficialContentGate>
					</div>
				) : null}

				{shouldRenderEdit ? (
					<div
						className={
							view === "edit" ? "absolute inset-0 block" : "absolute inset-0 hidden"
						}
						aria-hidden={view !== "edit"}
					>
						<WechatOfficialContentGate
							loading={loading}
							error={error}
							hasPost={Boolean(activePost)}
						>
							{activePost ? (
								<WechatEditView
									post={activePost}
									attachmentList={attachmentList}
									saveEditContent={saveEditContent}
									selectedProject={selectedProject}
									onChangePost={onChangePost}
									onChangeView={onChangeView}
									onEditingStateChange={handleEditingStateChange}
									onRequestViewChangeReady={handleRequestViewChangeReady}
									onRequestPostChangeReady={handleRequestPostChangeReady}
								/>
							) : null}
						</WechatOfficialContentGate>
					</div>
				) : null}

				{shouldRenderCode ? (
					<div
						className={
							view === "code" ? "absolute inset-0 block" : "absolute inset-0 hidden"
						}
						aria-hidden={view !== "code"}
					>
						<WechatOfficialContentGate
							loading={loading}
							error={error}
							hasPost={Boolean(activePost)}
						>
							{activePost ? (
								<WechatCodeView
									post={activePost}
									attachmentList={attachmentList}
									saveEditContent={saveEditContent}
									onChangePost={onChangePost}
									onChangeView={onChangeView}
									onEditingStateChange={handleCodeEditingStateChange}
									onRequestViewChangeReady={handleCodeRequestViewChangeReady}
									onRequestPostChangeReady={handleCodeRequestPostChangeReady}
								/>
							) : null}
						</WechatOfficialContentGate>
					</div>
				) : null}
			</div>
		</div>
	)
}

export default observer(WechatOfficialShell)
