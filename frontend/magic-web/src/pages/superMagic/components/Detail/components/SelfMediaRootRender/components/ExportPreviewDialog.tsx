import { memo, useCallback, useEffect, useMemo, useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { cn } from "@/lib/utils"
import CardFrame from "./CardFrame"
import type { SelfMediaAttachmentNode, SelfMediaPost } from "../types"

export interface ExportPreviewConfirmArgs {
	postIndex: number
	cardIndexes: number[]
	pixelRatio: number
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
	 * CSS pixel size for labels (W×H×ratio). Defaults to 1080×1440 card canvas;
	 * override when iframe body size differs.
	 */
	exportSizeHintCss?: { width: number; height: number }
}

const PIXEL_RATIO_OPTIONS = [1, 2, 4] as const
const PREVIEW_INITIAL_BATCH = 8
const PREVIEW_BATCH_SIZE = 8
/** localStorage key for last chosen export scale (1/2/4). */
const EXPORT_PIXEL_RATIO_STORAGE_KEY = "dtyq:self-media:export-pixel-ratio"
/**
 * Self-media card canvas (3:4). Capture size = this × pixelRatio
 * (e.g. 2x → 2160×2880). Varies if card HTML has different body size.
 */
const EXPORT_SIZE_HINT_CSS = { width: 1080, height: 1440 } as const

function isPixelRatioOption(value: number): value is (typeof PIXEL_RATIO_OPTIONS)[number] {
	return (PIXEL_RATIO_OPTIONS as readonly number[]).includes(value)
}

function readStoredPixelRatio(): number {
	if (typeof window === "undefined") return 2
	try {
		const raw = window.localStorage.getItem(EXPORT_PIXEL_RATIO_STORAGE_KEY)
		const parsed = raw === null || raw === "" ? NaN : Number(raw)
		if (isPixelRatioOption(parsed)) return parsed
	} catch {
		// ignore quota / private mode
	}
	return 2
}

function persistPixelRatio(ratio: number): void {
	if (typeof window === "undefined") return
	if (!isPixelRatioOption(ratio)) return
	try {
		window.localStorage.setItem(EXPORT_PIXEL_RATIO_STORAGE_KEY, String(ratio))
	} catch {
		// ignore
	}
}

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
}: ExportPreviewDialogProps) {
	const { t } = useTranslation("super")

	const [selectedPostIndex, setSelectedPostIndex] = useState(initialPostIndex)
	const [selectedCards, setSelectedCards] = useState<Set<number>>(() =>
		buildAllCardIndexes(posts[initialPostIndex]),
	)
	const [pixelRatio, setPixelRatio] = useState<number>(() => readStoredPixelRatio())

	// Reset state each time the dialog opens; seed with current active post.
	useEffect(() => {
		if (!open) return
		const safeIndex = Math.min(Math.max(initialPostIndex, 0), Math.max(posts.length - 1, 0))
		setSelectedPostIndex(safeIndex)
		setSelectedCards(buildAllCardIndexes(posts[safeIndex]))
		setPixelRatio(readStoredPixelRatio())
	}, [open, initialPostIndex, posts])

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
			onSyncActivePost?.(nextIndex)
		},
		[onSyncActivePost, posts],
	)

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

	const hintW = Math.max(0, Math.floor(exportSizeHintCss.width))
	const hintH = Math.max(0, Math.floor(exportSizeHintCss.height))

	const disableConfirm = isExporting || orderedCardIndexes.length === 0

	const handleConfirm = useCallback(async () => {
		if (disableConfirm) return
		await onConfirm({
			postIndex: selectedPostIndex,
			cardIndexes: orderedCardIndexes,
			pixelRatio,
		})
	}, [disableConfirm, onConfirm, orderedCardIndexes, pixelRatio, selectedPostIndex])

	const handleCancel = useCallback(() => {
		if (isExporting) return
		onOpenChange(false)
	}, [isExporting, onOpenChange])

	return (
		<Dialog open={open} onOpenChange={(next) => !isExporting && onOpenChange(next)}>
			<DialogContent
				className="flex max-h-[85vh] w-full !max-w-6xl flex-col gap-4"
				data-testid="self-media-export-dialog"
			>
				<DialogHeader>
					<DialogTitle data-testid="self-media-export-dialog-title">
						{t("detail.selfMedia.export.dialogTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("detail.selfMedia.export.dialogDescription")}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2">
					<Label className="text-xs font-medium text-muted-foreground">
						{t("detail.selfMedia.export.postSelectorLabel")}
					</Label>
					<Select
						value={String(selectedPostIndex)}
						onValueChange={handleChangePost}
						disabled={isExporting || posts.length === 0}
					>
						<SelectTrigger
							className="h-9"
							data-testid="self-media-export-post-selector"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{posts.map((post, idx) => {
								const label =
									post.meta.title ||
									post.meta.feedTitle ||
									t("detail.selfMedia.common.postFallbackTitle", {
										index: idx + 1,
									})
								return (
									<SelectItem
										key={post.meta.id || idx}
										value={String(idx)}
										data-testid={`self-media-export-post-option-${idx}`}
									>
										{label}
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center justify-between">
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
						onClick={handleToggleAll}
						disabled={isExporting || totalCards === 0}
						data-testid="self-media-export-toggle-all"
					>
						{isAllSelected
							? t("detail.selfMedia.export.selectNone")
							: t("detail.selfMedia.export.selectAll")}
					</Button>
				</div>

				<div
					className="min-h-[180px] flex-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-3"
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
										"group relative flex flex-col overflow-hidden rounded-md border bg-background text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										checked
											? "border-primary shadow-sm"
											: "border-border hover:border-primary/40",
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
											className="bg-background shadow-sm"
											data-testid={`self-media-export-card-checkbox-${cardIdx}`}
										/>
									</span>
									<div className="aspect-[3/4] w-full overflow-hidden bg-muted">
										{card.fileId ? (
											<CardFrame
												cardId={`export-preview-${selectedPost.meta.id}-${cardIdx}`}
												fileId={card.fileId}
												attachmentList={attachmentList}
												className="pointer-events-none h-full w-full"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
												{cardLabel}
											</div>
										)}
									</div>
									<div className="truncate px-2 py-1.5 text-xs">{cardLabel}</div>
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

				<div
					className="flex w-full items-end justify-end gap-2"
					data-testid="self-media-export-scale-section"
				>
					{t("detail.selfMedia.export.scaleLabel")}
					<RadioGroup
						value={String(pixelRatio)}
						onValueChange={(value) => {
							const next = Number(value)
							setPixelRatio(next)
							persistPixelRatio(next)
						}}
						className="flex shrink-0 justify-end gap-4"
						data-testid="self-media-export-scale-group"
					>
						{PIXEL_RATIO_OPTIONS.map((ratio) => {
							const id = `self-media-export-scale-${ratio}x`
							const outW = hintW * ratio
							const outH = hintH * ratio
							return (
								<div key={ratio} className="flex items-center gap-2">
									<RadioGroupItem
										id={id}
										value={String(ratio)}
										disabled={isExporting}
										data-testid={`self-media-export-scale-option-${ratio}x`}
									/>
									<Label
										htmlFor={id}
										className="flex cursor-pointer items-center gap-2 text-sm"
									>
										<span>
											{t("detail.selfMedia.export.scaleOption", { ratio })}
										</span>
										<span
											className="text-xs font-normal tabular-nums text-muted-foreground"
											data-testid={`self-media-export-scale-size-${ratio}x`}
										>
											{t("detail.selfMedia.export.scaleOutputSize", {
												width: outW,
												height: outH,
											})}
										</span>
									</Label>
								</div>
							)
						})}
					</RadioGroup>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={handleCancel}
						disabled={isExporting}
						data-testid="self-media-export-cancel"
					>
						{t("detail.selfMedia.export.cancel")}
					</Button>
					<Button
						type="button"
						onClick={handleConfirm}
						disabled={disableConfirm}
						data-testid="self-media-export-confirm"
					>
						{isExporting
							? t("detail.selfMedia.export.exporting")
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
