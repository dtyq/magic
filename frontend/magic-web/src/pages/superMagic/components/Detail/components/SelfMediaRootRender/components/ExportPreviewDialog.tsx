import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Label } from "@/components/shadcn-ui/label"
import { cn } from "@/utils/cn"
import CardFrame from "./CardFrame"
import type { CardFrameRef } from "./CardFrame"
import ExportOptionsSections from "./ExportOptionsSections"
import type { ExportCaptureSize } from "./ExportOptionsSections"
import ExportPostSelector from "./ExportPostSelector"
import { persistPixelRatio, readStoredPixelRatio } from "./exportPixelRatioStorage"
import { selfMediaOverlayStyles } from "./selfMediaOverlayStyles"
import WechatExportProducts from "./WechatExportProducts"
import type { SelfMediaAttachmentNode, SelfMediaPost, SelfMediaWechatCoverType } from "../types"
import { DEFAULT_SELF_MEDIA_EXPORT_FORMAT } from "../utils/exportImageFormat"
import type { SelfMediaExportFormat } from "../utils/exportImageFormat"

export type SelfMediaExportType = "cardsZip" | "longImage" | "wechatCoverImage"
export type SelfMediaExportMode = "cards" | "wechatOfficial"

export interface ExportPreviewConfirmArgs {
	postIndex: number
	cardIndexes: number[]
	pixelRatio: number
	format: SelfMediaExportFormat
	exportType: SelfMediaExportType
	getCardRef: (cardIndex: number) => CardFrameRef | null
}

interface ExportPreviewDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	posts: SelfMediaPost[]
	initialPostIndex: number
	attachmentList?: SelfMediaAttachmentNode[]
	/** Notify the shell so the target post's cards can mount (for refs). */
	onSyncActivePost?: (postIndex: number) => void
	onConfirm: (args: ExportPreviewConfirmArgs) => Promise<void> | void
	isExporting?: boolean
	/**
	 * Fixed CSS-pixel size for non-card export surfaces such as the WeChat cover.
	 * Card exports read their dimensions from the mounted iframe content.
	 */
	exportSizeHintCss?: { width: number; height: number }
	/** Platform-specific export surface. WeChat has cover image + HTML copy outputs. */
	exportMode?: SelfMediaExportMode
	onCopyWechatHtml?: () => Promise<void> | void
	isCopyingWechatHtml?: boolean
	onGenerateWechatCovers?: (args: {
		postIndex: number
		coverTypes: SelfMediaWechatCoverType[]
	}) => Promise<boolean | void> | boolean | void
}

const PREVIEW_INITIAL_BATCH = 8
const PREVIEW_BATCH_SIZE = 8
/** Fallback size for fixed export surfaces that do not mount card iframes. */
const EXPORT_SIZE_HINT_CSS = { width: 1080, height: 1440 } as const

function buildAllCardIndexes(post: SelfMediaPost | undefined): Set<number> {
	if (!post) return new Set()
	return new Set(post.cards.map((_, idx) => idx))
}

function ExportPreviewDialog({
	open,
	onOpenChange,
	posts,
	initialPostIndex,
	attachmentList,
	onSyncActivePost,
	onConfirm,
	isExporting = false,
	exportSizeHintCss = EXPORT_SIZE_HINT_CSS,
	exportMode = "cards",
	onCopyWechatHtml,
	isCopyingWechatHtml = false,
	onGenerateWechatCovers,
}: ExportPreviewDialogProps) {
	const { t } = useTranslation("super")

	const [selectedPostIndex, setSelectedPostIndex] = useState(initialPostIndex)
	const [selectedCards, setSelectedCards] = useState<Set<number>>(() =>
		buildAllCardIndexes(posts[initialPostIndex]),
	)
	const [pixelRatio, setPixelRatio] = useState<number>(() => readStoredPixelRatio())
	const [format, setFormat] = useState<SelfMediaExportFormat>(DEFAULT_SELF_MEDIA_EXPORT_FORMAT)
	const [exportType, setExportType] = useState<SelfMediaExportType>("cardsZip")
	const [previewVersion, setPreviewVersion] = useState(0)
	const [loadedPreviewCards, setLoadedPreviewCards] = useState<Set<number>>(() => new Set())
	const previewCardRefs = useRef<Record<number, CardFrameRef | null>>({})

	// Reset state each time the dialog opens; seed with current active post.
	useEffect(() => {
		if (!open) return
		const safeIndex = Math.min(Math.max(initialPostIndex, 0), Math.max(posts.length - 1, 0))
		setSelectedPostIndex(safeIndex)
		setSelectedCards(buildAllCardIndexes(posts[safeIndex]))
		setPixelRatio(readStoredPixelRatio())
		setFormat(DEFAULT_SELF_MEDIA_EXPORT_FORMAT)
		setExportType(exportMode === "wechatOfficial" ? "wechatCoverImage" : "cardsZip")
		setPreviewVersion((prev) => prev + 1)
		setLoadedPreviewCards(new Set())
		previewCardRefs.current = {}
	}, [open, initialPostIndex, posts, exportMode])

	const selectedPost = posts[selectedPostIndex]
	const totalCards = selectedPost?.cards.length ?? 0
	const selectedCount = selectedCards.size
	const isAllSelected = totalCards > 0 && selectedCount === totalCards
	const [visiblePreviewCount, setVisiblePreviewCount] = useState(PREVIEW_INITIAL_BATCH)

	const handleChangePost = useCallback(
		(value: string) => {
			const nextIndex = Number(value)
			if (Number.isNaN(nextIndex)) return
			setSelectedPostIndex(nextIndex)
			setSelectedCards(buildAllCardIndexes(posts[nextIndex]))
			setLoadedPreviewCards(new Set())
			previewCardRefs.current = {}
			onSyncActivePost?.(nextIndex)
		},
		[onSyncActivePost, posts],
	)

	const handlePreviewCardLoaded = useCallback((cardIndex: number) => {
		setLoadedPreviewCards((prev) => {
			if (prev.has(cardIndex)) return prev
			const next = new Set(prev)
			next.add(cardIndex)
			return next
		})
	}, [])

	const toggleCard = useCallback((cardIndex: number) => {
		setSelectedCards((prev) => {
			const next = new Set(prev)
			if (next.has(cardIndex)) next.delete(cardIndex)
			else next.add(cardIndex)
			return next
		})
	}, [])

	const handleToggleAll = useCallback(() => {
		setSelectedCards((prev) => {
			if (prev.size === totalCards) return new Set()
			return buildAllCardIndexes(selectedPost)
		})
	}, [selectedPost, totalCards])

	useEffect(() => {
		if (!open) return
		setVisiblePreviewCount(PREVIEW_INITIAL_BATCH)
	}, [open, selectedPostIndex])

	useEffect(() => {
		if (!open) return
		if (totalCards <= PREVIEW_INITIAL_BATCH) return

		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | null = null

		const loadNextBatch = () => {
			if (cancelled) return
			setVisiblePreviewCount((prev) => {
				const next = Math.min(prev + PREVIEW_BATCH_SIZE, totalCards)
				if (next < totalCards) {
					timer = setTimeout(loadNextBatch, 16)
				}
				return next
			})
		}

		timer = setTimeout(loadNextBatch, 16)

		return () => {
			cancelled = true
			if (timer) clearTimeout(timer)
		}
	}, [open, selectedPostIndex, totalCards])

	const orderedCardIndexes = useMemo(
		() => Array.from(selectedCards).sort((a, b) => a - b),
		[selectedCards],
	)
	const visibleCards = useMemo(
		() => selectedPost?.cards.slice(0, visiblePreviewCount) || [],
		[selectedPost?.cards, visiblePreviewCount],
	)
	const isPreviewLoading = open && totalCards > visibleCards.length
	const selectedCardSizes = useMemo<ExportCaptureSize[]>(
		() =>
			orderedCardIndexes.flatMap((cardIndex) => {
				if (!loadedPreviewCards.has(cardIndex)) return []
				const size = previewCardRefs.current[cardIndex]?.getCaptureSize?.()
				if (!size || size.width <= 0 || size.height <= 0) return []
				return [{ width: Math.round(size.width), height: Math.round(size.height) }]
			}),
		[loadedPreviewCards, orderedCardIndexes],
	)

	const hintW = Math.max(0, Math.floor(exportSizeHintCss.width))
	const hintH = Math.max(0, Math.floor(exportSizeHintCss.height))

	const isWechatOfficialMode = exportMode === "wechatOfficial"
	const areSelectedCardsReady =
		isWechatOfficialMode ||
		orderedCardIndexes.every(
			(cardIndex) =>
				Boolean(selectedPost?.cards[cardIndex]?.fileId) &&
				cardIndex < visiblePreviewCount &&
				loadedPreviewCards.has(cardIndex),
		)
	const hasWechatCoverAssets = Boolean(
		selectedPost?.thumbnailCover?.fileId && selectedPost?.heroCover?.fileId,
	)
	const dialogSizeClass = isWechatOfficialMode
		? "max-h-[720px] !max-w-5xl"
		: "h-[85vh] max-h-[900px] !max-w-6xl"
	const disableConfirm =
		isExporting ||
		(isWechatOfficialMode ? !hasWechatCoverAssets : orderedCardIndexes.length === 0) ||
		!areSelectedCardsReady

	const handleConfirm = useCallback(async () => {
		if (disableConfirm) return
		const previewCardRefsSnapshot = { ...previewCardRefs.current }
		await onConfirm({
			postIndex: selectedPostIndex,
			cardIndexes: isWechatOfficialMode ? [] : orderedCardIndexes,
			pixelRatio,
			format,
			exportType: isWechatOfficialMode ? "wechatCoverImage" : exportType,
			getCardRef: (cardIndex) => previewCardRefsSnapshot[cardIndex] || null,
		})
	}, [
		disableConfirm,
		exportType,
		isWechatOfficialMode,
		onConfirm,
		orderedCardIndexes,
		pixelRatio,
		format,
		selectedPostIndex,
	])

	const handleCancel = useCallback(() => {
		if (isExporting) return
		onOpenChange(false)
	}, [isExporting, onOpenChange])

	return (
		<Dialog open={open} onOpenChange={(next) => !isExporting && onOpenChange(next)}>
			<DialogContent
				className={cn(
					"flex w-full flex-col gap-0",
					dialogSizeClass,
					selfMediaOverlayStyles.dialogSurface,
				)}
				data-testid="self-media-export-dialog"
			>
				<DialogHeader className={selfMediaOverlayStyles.dialogHeader}>
					<DialogTitle
						className={selfMediaOverlayStyles.dialogTitle}
						data-testid="self-media-export-dialog-title"
					>
						{t("detail.selfMedia.export.dialogTitle")}
					</DialogTitle>
					<DialogDescription className={selfMediaOverlayStyles.dialogDescription}>
						{t("detail.selfMedia.export.dialogDescription")}
					</DialogDescription>
				</DialogHeader>

				<ExportPostSelector
					posts={posts}
					selectedPostIndex={selectedPostIndex}
					onChange={handleChangePost}
					disabled={isExporting}
				/>

				{!isWechatOfficialMode ? (
					<div className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6">
						<div className="flex items-center gap-2">
							<Label className="text-xs font-medium text-muted-foreground">
								{t("detail.selfMedia.export.selectCards")}
							</Label>
							<span
								className="text-xs text-muted-foreground"
								data-testid="self-media-export-selected-summary"
							>
								{t("detail.selfMedia.export.selectedSummary", {
									count: selectedCount,
									total: totalCards,
								})}
							</span>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={handleToggleAll}
							disabled={isExporting || totalCards === 0}
							data-testid="self-media-export-toggle-all"
						>
							{isAllSelected
								? t("detail.selfMedia.export.selectNone")
								: t("detail.selfMedia.export.selectAll")}
						</Button>
					</div>
				) : null}

				{!isWechatOfficialMode ? (
					<div
						className="mx-4 mt-4 min-h-0 flex-1 overflow-y-auto rounded-[24px] bg-white/90 p-3 shadow-[inset_0_1px_rgba(255,255,255,0.82)] sm:mx-6"
						data-testid="self-media-export-card-grid"
					>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
							{visibleCards.map((card, cardIdx) => {
								const checked = selectedCards.has(cardIdx)
								const cardKey = card.fileId || card.path || String(cardIdx)
								const cardLabel = t("detail.selfMedia.export.cardFallbackTitle", {
									index: cardIdx + 1,
								})
								return (
									<div
										key={cardKey}
										role="button"
										tabIndex={isExporting ? -1 : 0}
										aria-pressed={checked}
										aria-disabled={isExporting || undefined}
										onClick={() => !isExporting && toggleCard(cardIdx)}
										onKeyDown={(event) => {
											if (isExporting) return
											if (event.key === " " || event.key === "Enter") {
												event.preventDefault()
												toggleCard(cardIdx)
											}
										}}
										data-testid={`self-media-export-card-item-${cardIdx}`}
										className={cn(
											"group relative flex flex-col overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											checked
												? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/50"
												: "border-border bg-background hover:border-primary/40",
											isExporting
												? "cursor-not-allowed opacity-60"
												: "cursor-pointer",
										)}
									>
										<span className="absolute left-2 top-2 z-10">
											<Checkbox
												checked={checked}
												onCheckedChange={() => toggleCard(cardIdx)}
												onClick={(event) => event.stopPropagation()}
												aria-label={cardLabel}
												className="shadow-sm data-[state=unchecked]:bg-background"
												data-testid={`self-media-export-card-checkbox-${cardIdx}`}
											/>
										</span>
										<div className="aspect-[3/4] w-full overflow-hidden bg-muted">
											{card.fileId ? (
												<CardFrame
													cardId={`export-preview-${selectedPost.meta.id}-${cardIdx}`}
													fileId={card.fileId}
													version={`${card.version ?? ""}:export:${previewVersion}`}
													attachmentList={attachmentList}
													className="pointer-events-none h-full w-full"
													onLoaded={() =>
														handlePreviewCardLoaded(cardIdx)
													}
													ref={(node) => {
														previewCardRefs.current[cardIdx] = node
													}}
												/>
											) : (
												<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
													{cardLabel}
												</div>
											)}
										</div>
										<div
											className={cn(
												"truncate px-2 py-1.5 text-xs",
												checked && "font-medium text-primary",
											)}
										>
											{cardLabel}
										</div>
									</div>
								)
							})}
						</div>
						{isPreviewLoading ? (
							<div
								className="mt-3 text-center text-xs text-muted-foreground"
								data-testid="self-media-export-preview-loading"
							>
								{t("detail.selfMedia.common.loading")}
							</div>
						) : null}
					</div>
				) : (
					<WechatExportProducts
						post={selectedPost}
						postIndex={selectedPostIndex}
						onCopyWechatHtml={onCopyWechatHtml}
						isCopyingWechatHtml={isCopyingWechatHtml}
						onGenerateWechatCovers={onGenerateWechatCovers}
						generationDisabled={isExporting}
					/>
				)}

				<ExportOptionsSections
					isWechatOfficialMode={isWechatOfficialMode}
					exportType={exportType}
					onExportTypeChange={setExportType}
					pixelRatio={pixelRatio}
					format={format}
					onFormatChange={setFormat}
					onPixelRatioChange={(next) => {
						setPixelRatio(next)
						persistPixelRatio(next)
					}}
					isExporting={isExporting}
					hintW={hintW}
					hintH={hintH}
					selectedCardCount={orderedCardIndexes.length}
					selectedCardSizes={selectedCardSizes}
				/>

				<DialogFooter
					className={cn("shrink-0", selfMediaOverlayStyles.dialogFooter)}
					data-testid="self-media-export-footer"
				>
					<Button
						type="button"
						variant="outline"
						className={selfMediaOverlayStyles.secondaryButton}
						onClick={handleCancel}
						disabled={isExporting}
						data-testid="self-media-export-cancel"
					>
						{t("detail.selfMedia.export.cancel")}
					</Button>
					<Button
						type="button"
						className={selfMediaOverlayStyles.primaryButton}
						onClick={handleConfirm}
						disabled={disableConfirm}
						data-testid="self-media-export-confirm"
					>
						{isExporting
							? t("detail.selfMedia.export.exporting")
							: isWechatOfficialMode
								? t("detail.selfMedia.export.wechat.exportCover")
								: t("detail.selfMedia.export.confirmWithCount", {
										count: orderedCardIndexes.length,
									})}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default memo(ExportPreviewDialog)
