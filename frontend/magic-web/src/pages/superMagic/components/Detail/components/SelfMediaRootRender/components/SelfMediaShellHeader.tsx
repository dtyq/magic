import { memo, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import {
	Check,
	ChevronLeft,
	ClipboardCheck,
	Crosshair,
	Loader2,
	Pencil,
	RefreshCw,
	Share2,
	X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import ExportPanel from "./ExportPanel"
import PlatformBrandIcon from "./PlatformBrandIcon"
import ViewTabs from "./ViewTabs"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaPost, SelfMediaView } from "../types"

const EDIT_RELATED_SELF_MEDIA_VIEWS = new Set<SelfMediaView>(["edit", "code"])

interface SelfMediaShellHeaderProps {
	platform: SelfMediaPlatform
	posts: SelfMediaPost[]
	activePostIndex: number
	view: SelfMediaView
	tabLabels: Partial<Record<SelfMediaView, string>>
	visibleTabs: SelfMediaView[]
	onChangeView: (view: SelfMediaView) => void
	onRefresh: () => void
	onBackHome?: () => void
	refreshLabel: string
	refreshDisabled?: boolean
	refreshTestId: string
	onShare?: () => void
	shareLoading?: boolean
	exportAction?: ReactNode
	exportLabel?: string
	exportDisabled?: boolean
	onOpenExport?: () => void
	onStartInspector?: () => void
	onStopInspector?: () => void
	inspectorActive?: boolean
	inspectorDisabled?: boolean
	onSaveTitle?: (title: string) => Promise<boolean | void> | boolean | void
}

interface SelfMediaShellViewBarProps {
	view: SelfMediaView
	tabLabels: Partial<Record<SelfMediaView, string>>
	visibleTabs: SelfMediaView[]
	onChangeView: (view: SelfMediaView) => void
	onRequestPrePublishAnalysis?: () => void
}

function SelfMediaShellHeader({
	platform,
	posts,
	activePostIndex,
	onRefresh,
	onBackHome,
	refreshLabel,
	refreshDisabled,
	refreshTestId,
	onShare,
	shareLoading,
	exportAction,
	exportLabel,
	exportDisabled,
	onOpenExport,
	onStartInspector,
	onStopInspector,
	inspectorActive,
	inspectorDisabled,
	onSaveTitle,
}: SelfMediaShellHeaderProps) {
	const { t } = useTranslation("super")
	const activePost = posts[activePostIndex]
	const articleTitle =
		activePost?.meta.title ||
		activePost?.meta.feedTitle ||
		t("detail.selfMedia.common.postFallbackTitle", { index: activePostIndex + 1 })
	const [editingTitle, setEditingTitle] = useState(false)
	const [draftTitle, setDraftTitle] = useState(articleTitle)
	const [savingTitle, setSavingTitle] = useState(false)
	const [titleError, setTitleError] = useState<string | null>(null)

	useEffect(() => {
		if (editingTitle) return
		setDraftTitle(articleTitle)
	}, [articleTitle, editingTitle])

	const handleStartEditTitle = () => {
		if (!onSaveTitle) return
		setDraftTitle(articleTitle)
		setTitleError(null)
		setEditingTitle(true)
	}

	const handleCancelEditTitle = () => {
		setDraftTitle(articleTitle)
		setTitleError(null)
		setEditingTitle(false)
	}

	const handleSubmitTitle = async (event?: FormEvent<HTMLFormElement>) => {
		event?.preventDefault()
		if (!onSaveTitle || savingTitle) return
		const nextTitle = draftTitle.trim()
		if (!nextTitle) {
			setTitleError(t("detail.selfMedia.titleEdit.empty", "标题不能为空"))
			return
		}
		if (nextTitle === articleTitle) {
			setEditingTitle(false)
			setTitleError(null)
			return
		}
		setSavingTitle(true)
		setTitleError(null)
		try {
			const saved = await onSaveTitle(nextTitle)
			if (saved === false) {
				setTitleError(t("detail.selfMedia.titleEdit.failed", "标题保存失败，请稍后重试"))
				return
			}
			setEditingTitle(false)
		} catch {
			setTitleError(t("detail.selfMedia.titleEdit.failed", "标题保存失败，请稍后重试"))
		} finally {
			setSavingTitle(false)
		}
	}

	return (
		<header
			className="flex min-h-[72px] flex-wrap items-center gap-3 bg-transparent px-3 py-2 max-sm:min-h-0 max-sm:gap-2 max-sm:px-2 max-sm:py-1.5 sm:min-h-[88px] sm:px-4 sm:py-3 lg:gap-4 lg:px-6"
			data-testid="self-media-shell-header"
		>
			<div
				className="flex min-w-[20rem] flex-1 basis-[24rem] items-center gap-3 max-sm:min-w-0 max-sm:basis-auto max-sm:gap-2"
				data-testid="self-media-shell-title"
			>
				{onBackHome ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-10 shrink-0 rounded-[14px] border-[#e4e4e7] bg-white px-3 text-sm font-[700] text-[#18181b] shadow-[0_3px_12px_rgba(24,24,27,0.06)] hover:bg-white hover:text-[#18181b] max-sm:size-9 max-sm:rounded-[12px] max-sm:px-0 sm:h-11 sm:px-4"
						onClick={onBackHome}
						data-testid="self-media-shell-back-home-button"
					>
						<ChevronLeft size={17} />
						<span className="max-sm:sr-only">
							{t("detail.selfMedia.home.backHome")}
						</span>
					</Button>
				) : null}
				<span
					className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#18181b] shadow-[0_3px_12px_rgba(24,24,27,0.06)] max-sm:hidden sm:size-11"
					data-testid="self-media-shell-platform-icon-frame"
				>
					<PlatformBrandIcon
						platform={platform}
						className="size-5"
						testId="self-media-shell-platform-icon"
					/>
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-1.5">
						<p className="text-xs font-[700] leading-[1.2] text-[#71717a]">
							{t("detail.selfMedia.home.article")}
						</p>
						<span
							className="hidden size-6 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#18181b] shadow-[0_2px_8px_rgba(24,24,27,0.06)] max-sm:flex"
							data-testid="self-media-shell-mobile-platform-icon"
						>
							<PlatformBrandIcon platform={platform} className="size-4" />
						</span>
					</div>
					{editingTitle ? (
						<form
							className="mt-1 flex min-w-0 items-center gap-2"
							onSubmit={handleSubmitTitle}
							data-testid="handle-submit-title"
						>
							<div className="min-w-0 flex-1">
								<Input
									value={draftTitle}
									onChange={(event) => setDraftTitle(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Escape") handleCancelEditTitle()
									}}
									disabled={savingTitle}
									autoFocus
									className="h-9 rounded-[12px] border-[#d4d4d8] bg-white px-3 text-base font-[800] text-[#18181b] shadow-none focus-visible:ring-[#18181b]/15"
									data-testid="self-media-shell-title-input"
									aria-label={t("detail.selfMedia.titleEdit.input", "文章标题")}
								/>
								{titleError ? (
									<p className="mt-1 text-xs font-[600] text-[#dc2626]">
										{titleError}
									</p>
								) : null}
							</div>
							<Button
								type="submit"
								variant="ghost"
								size="icon"
								disabled={savingTitle}
								className="size-9 shrink-0 rounded-[12px] text-[#18181b] hover:bg-[#f1f1f2] hover:text-[#18181b]"
								data-testid="self-media-shell-save-title-button"
								aria-label={t("detail.selfMedia.titleEdit.save", "保存标题")}
							>
								{savingTitle ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Check className="h-4 w-4" />
								)}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								disabled={savingTitle}
								onClick={handleCancelEditTitle}
								className="size-9 shrink-0 rounded-[12px] text-[#71717a] hover:bg-[#f1f1f2] hover:text-[#18181b]"
								data-testid="self-media-shell-cancel-title-button"
								aria-label={t("detail.selfMedia.titleEdit.cancel", "取消编辑")}
							>
								<X className="h-4 w-4" />
							</Button>
						</form>
					) : (
						<div className="mt-0.5 flex min-w-0 items-start gap-1.5">
							<h2
								className="min-w-0 whitespace-normal break-words text-sm font-[800] leading-[1.3] text-[#18181b] max-sm:text-[13px] sm:text-base sm:leading-[1.25]"
								data-testid="self-media-shell-platform-title"
							>
								{articleTitle}
							</h2>
							{onSaveTitle ? (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={handleStartEditTitle}
											className="mt-[-4px] size-8 shrink-0 rounded-[12px] text-[#71717a] hover:bg-[#f1f1f2] hover:text-[#18181b]"
											data-testid="self-media-shell-edit-title-button"
											aria-label={t(
												"detail.selfMedia.titleEdit.edit",
												"编辑标题",
											)}
										>
											<Pencil className="h-3.5 w-3.5" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{t("detail.selfMedia.titleEdit.edit", "编辑标题")}
									</TooltipContent>
								</Tooltip>
							) : null}
						</div>
					)}
				</div>
			</div>
			<div className="ml-auto flex min-w-0 items-center justify-end gap-3 max-md:items-start lg:gap-4">
				<div
					className="-m-1 flex max-w-full shrink-0 items-center justify-end gap-1 overflow-visible rounded-[18px] p-1 max-lg:overflow-x-auto sm:-m-2 sm:gap-2 sm:p-2"
					data-testid="self-media-shell-toolbar"
				>
					<div className="flex h-10 shrink-0 items-center gap-1 rounded-[14px] bg-white/80 px-1 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_3px_14px_rgba(24,24,27,0.05)] sm:h-12 sm:gap-2 sm:rounded-[18px] sm:px-2">
						{onStartInspector && !inspectorDisabled ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										onClick={
											inspectorActive ? onStopInspector : onStartInspector
										}
										data-testid="self-media-shell-inspector-button"
										aria-label={t("detail.selfMedia.common.inspectElement")}
										variant="ghost"
										size="icon"
										className={cn(
											"size-9 rounded-[12px] text-[#18181b] hover:bg-[#f1f1f2] hover:text-[#18181b] sm:size-10 sm:rounded-[14px]",
											inspectorActive &&
												"bg-[#18181b] text-white hover:bg-[#18181b] hover:text-white",
										)}
									>
										<Crosshair className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{t("detail.selfMedia.common.inspectElement")}
								</TooltipContent>
							</Tooltip>
						) : null}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									disabled={refreshDisabled}
									onClick={onRefresh}
									data-testid={refreshTestId}
									aria-label={refreshLabel}
									variant="ghost"
									size="icon"
									className="size-9 rounded-[12px] text-[#18181b] hover:bg-[#f1f1f2] hover:text-[#18181b] sm:size-10 sm:rounded-[14px]"
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>{refreshLabel}</TooltipContent>
						</Tooltip>
						{onShare ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										disabled={shareLoading}
										onClick={onShare}
										data-testid="self-media-shell-share-button"
										aria-label={t("fileViewer.share")}
										variant="ghost"
										size="icon"
										className="size-9 rounded-[12px] text-[#18181b] hover:bg-[#f1f1f2] hover:text-[#18181b] sm:size-10 sm:rounded-[14px]"
									>
										{shareLoading ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Share2 className="h-4 w-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>{t("fileViewer.share")}</TooltipContent>
							</Tooltip>
						) : null}
					</div>
					{exportAction ??
						(onOpenExport ? (
							<ExportPanel
								onOpen={onOpenExport}
								label={exportLabel}
								disabled={exportDisabled}
							/>
						) : null)}
				</div>
			</div>
		</header>
	)
}

export function SelfMediaShellViewBar({
	view,
	tabLabels,
	visibleTabs,
	onChangeView,
	onRequestPrePublishAnalysis,
}: SelfMediaShellViewBarProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const resolvedVisibleTabs = useMemo(() => {
		if (!isMobile) return visibleTabs
		return visibleTabs.filter((tab) => !EDIT_RELATED_SELF_MEDIA_VIEWS.has(tab))
	}, [isMobile, visibleTabs])

	useEffect(() => {
		if (!isMobile || !EDIT_RELATED_SELF_MEDIA_VIEWS.has(view)) return
		const fallbackView = resolvedVisibleTabs[0]
		if (fallbackView) onChangeView(fallbackView)
	}, [isMobile, onChangeView, resolvedVisibleTabs, view])

	return (
		<footer
			className="shrink-0 border-t border-[#f1f1f2] bg-white px-2 py-2 max-sm:py-1.5 sm:px-4 sm:py-3"
			data-testid="self-media-shell-view-bar"
		>
			<div className="mx-auto grid max-w-full grid-cols-[1fr_auto_1fr] items-center gap-3 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-2">
				<div aria-hidden="true" className="min-w-0 max-md:hidden" />
				<div className="flex min-w-0 justify-start overflow-x-auto max-sm:-mx-1 max-sm:px-1 sm:justify-center">
					<ViewTabs
						value={view}
						onChange={onChangeView}
						labels={tabLabels}
						order={resolvedVisibleTabs}
					/>
				</div>
				{onRequestPrePublishAnalysis ? (
					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onRequestPrePublishAnalysis}
							className="h-10 shrink-0 rounded-[14px] border-[#e4e4e7] bg-white px-3 text-xs font-[800] text-[#18181b] shadow-[0_3px_12px_rgba(24,24,27,0.06)] hover:bg-[#18181b] hover:text-white max-sm:size-10 max-sm:px-0"
							data-testid="self-media-footer-pre-publish-analysis"
						>
							<ClipboardCheck className="h-4 w-4" />
							<span className="max-sm:sr-only">
								{t("detail.selfMedia.analysis.action")}
							</span>
						</Button>
					</div>
				) : (
					<div aria-hidden="true" className="min-w-0 max-md:hidden" />
				)}
			</div>
		</footer>
	)
}

export default memo(SelfMediaShellHeader)
