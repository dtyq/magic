import {
	filterPptSlidePaths,
	normalizeHiddenSlides,
} from "@/pages/superMagic/utils/pptHiddenSlides"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { Label } from "@/components/shadcn-ui/label"
import { cn } from "@/utils/cn"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import type { SlideItem } from "../PPTRender/PPTSidebar/types"
import { observer } from "mobx-react-lite"
import { TSIcon } from "@/components/base"
import FileSlicesIcon from "./FileSlicesIcon"
import { resolvePptScaleContentDimensions } from "../../contents/HTML/utils/slide-dimensions"

import { Image as ImageIcon, Square, SquareCheck } from "lucide-react"

export type ExportFormat = "source" | "pdf" | "pptx" | "image_png" | "image_jpeg"

interface SlideSelectionDialogProps {
	/** 是否打开对话框 */
	open: boolean
	/** 关闭对话框回调 */
	onOpenChange: (open: boolean) => void
	/** 所有幻灯片列表 */
	slides: SlideItem[]
	hiddenSlides?: unknown
	/** 确认导出回调，传递选中的 filePaths 和导出格式 */
	onConfirm: (filePaths: string[], format: ExportFormat, includeHiddenSlides?: boolean) => void
	/** 是否正在导出 */
	isExporting?: boolean
	/** 生成截图回调 */
	onGenerateScreenshot?: (index: number) => Promise<void>
	/** 是否支持导出 PPTX */
	supportPptx?: boolean
}

function SlideSelectionDialog({
	open,
	onOpenChange,
	slides,
	hiddenSlides,
	onConfirm,
	isExporting = false,
	onGenerateScreenshot,
	supportPptx = true,
}: SlideSelectionDialogProps) {
	const { t } = useTranslation("super")
	const [includeHiddenSlides, setIncludeHiddenSlides] = useState(false)
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [exportFormat, setExportFormat] = useState<ExportFormat>(supportPptx ? "pptx" : "pdf")
	// 延后渲染列表，先让对话框壳出现，减轻首屏卡顿
	const [contentReady, setContentReady] = useState(false)

	// 弹窗打开时延后一帧再渲染列表；关闭时重置
	useEffect(() => {
		if (!open) {
			setContentReady(false)
			return
		}
		const rafId = requestAnimationFrame(() => {
			setContentReady(true)
		})
		return () => cancelAnimationFrame(rafId)
	}, [open])

	// 弹窗每次打开（false → true）默认只选中已加载完成的幻灯片；
	// 未加载完成（loading/error/idle）的不默认选中
	const prevOpenRef = useRef(false)
	useEffect(() => {
		if (open && !prevOpenRef.current) {
			setIncludeHiddenSlides(false)
			setSelectedIds(
				new Set(
					slides
						.filter((slide) => slide.loadingState === "loaded")
						.map((slide) => slide.path),
				),
			)
		}
		prevOpenRef.current = open
	}, [open, slides])

	// 当对话框打开且列表已就绪时，检查并生成缺失的缩略图
	useEffect(() => {
		if (!open || !contentReady || !onGenerateScreenshot) return

		// 找出所有没有缩略图且未在加载中的幻灯片
		const slidesNeedingThumbnails = slides
			.map((slide, index) => ({ slide, index }))
			.filter(
				({ slide }) =>
					!slide.thumbnailUrl &&
					!slide.thumbnailLoading &&
					slide.loadingState === "loaded",
			)

		// 异步生成缩略图（不阻塞UI）
		slidesNeedingThumbnails.forEach(({ index }) => {
			onGenerateScreenshot(index).catch((error) => {
				console.error(`Failed to generate screenshot for slide ${index}:`, error)
			})
		})
	}, [open, contentReady, slides, onGenerateScreenshot])

	// 已加载完成的幻灯片（不使用 useMemo，让 MobX observer 能追踪 observable 属性变化）
	const hiddenPaths = new Set(
		normalizeHiddenSlides(
			slides.map((slide) => slide.path),
			hiddenSlides,
		),
	)
	const eligiblePaths = new Set(
		filterPptSlidePaths(
			slides.map((slide) => slide.path),
			hiddenSlides,
			includeHiddenSlides || exportFormat === "source",
		),
	)
	const loadedSlides = slides.filter(
		(slide) => slide.loadingState === "loaded" && eligiblePaths.has(slide.path),
	)
	const selectedPaths = loadedSlides
		.filter((slide) => selectedIds.has(slide.path))
		.map((slide) => slide.path)

	// 计算是否全选（基于已加载的幻灯片）
	const isAllSelected =
		loadedSlides.length > 0 && loadedSlides.every((slide) => selectedIds.has(slide.path))

	// 切换单个幻灯片选择状态
	function toggleSlide(slideId: string) {
		setSelectedIds((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(slideId)) {
				newSet.delete(slideId)
			} else {
				newSet.add(slideId)
			}
			return newSet
		})
	}

	// 全选/取消全选（只操作已加载完成的幻灯片）
	function toggleSelectAll() {
		if (isAllSelected) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(loadedSlides.map((slide) => slide.path)))
		}
	}

	// 确认导出
	function handleConfirm() {
		const fileIds = selectedPaths
		if (fileIds.length === 0) {
			// 提示用户至少选择一页
			return
		}
		onConfirm(fileIds, exportFormat, includeHiddenSlides)
	}

	// 重置选择并关闭
	function handleClose() {
		setSelectedIds(new Set())
		setExportFormat(supportPptx ? "pptx" : "pdf")
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] !max-w-[calc(100vw-2rem)] flex-col p-6 xl:!max-w-[1100px]">
				<DialogHeader className="shrink-0">
					<DialogTitle>{t("ppt.selectSlidesToExport")}</DialogTitle>
					<DialogDescription>
						{selectedPaths.length > 0
							? t("ppt.selectedCount", { count: selectedPaths.length })
							: t("ppt.pleaseSelectSlides")}
					</DialogDescription>
				</DialogHeader>

				{/* 全选/取消全选按钮 */}
				<div className="flex shrink-0 items-center gap-2 border-b pb-2">
					<Button
						variant="outline"
						size="sm"
						onClick={toggleSelectAll}
						aria-pressed={isAllSelected}
						className="h-8 text-sm"
					>
						{isAllSelected ? <SquareCheck size={16} /> : <Square size={16} />}
						{isAllSelected ? t("ppt.deselectAll") : t("ppt.selectAll")}
					</Button>
					<span className="text-sm text-muted-foreground">
						{t("ppt.exportAllSlides", { total: slides.length })}
					</span>
				</div>

				{hiddenPaths.size > 0 && exportFormat !== "source" && (
					<Label className="flex shrink-0 items-center gap-2 text-sm">
						<Checkbox
							checked={includeHiddenSlides}
							onCheckedChange={(checked) => setIncludeHiddenSlides(checked === true)}
						/>
						{t("ppt.includeHiddenSlides")}
					</Label>
				)}
				{/* 幻灯片网格：延后渲染，先出壳再出列表 */}
				{/* 视口必须参与 flex 收缩，避免仅有 max-height 的弹窗中百分比高度被内容撑开。 */}
				<ScrollArea
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
					viewportClassName="min-h-0 flex-1 px-1"
				>
					{!contentReady ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 py-2">
							{Array.from({ length: 8 }).map((_, i) => (
								<div
									key={i}
									className="relative overflow-hidden rounded-lg border-2 border-border bg-card"
								>
									<div className="absolute left-2 top-2 z-10">
										<Skeleton className="size-4 rounded-sm" />
									</div>
									<Skeleton className="h-[160px] rounded-none" />
									<div className="space-y-1.5 border-t p-2">
										<Skeleton className="h-3.5 w-3/4 rounded" />
										<Skeleton className="h-3 w-1/2 rounded" />
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 py-2">
							{slides.map((slide, index) => {
								const isSelected =
									selectedIds.has(slide.path) && eligiblePaths.has(slide.path)
								const isLoaded =
									slide.loadingState === "loaded" && eligiblePaths.has(slide.path)
								const slideDimensions = resolvePptScaleContentDimensions(
									slide.content,
									slide.rawContent,
								)
								return (
									<div
										key={slide.id}
										onClick={() => isLoaded && toggleSlide(slide.path)}
										className={cn(
											"relative min-w-0 overflow-hidden rounded-lg border-2 transition-all",
											!isLoaded
												? "cursor-not-allowed opacity-50"
												: "cursor-pointer hover:shadow-md",
											isSelected
												? "border-primary bg-primary/5 shadow-sm"
												: "border-border hover:border-primary/50",
										)}
										data-testid="toggle-slide"
									>
										{/* 选择框 */}
										<div className="absolute left-2 top-2 z-10">
											<Checkbox
												checked={isSelected}
												onClick={(event) => event.stopPropagation()}
												disabled={!isLoaded}
												onCheckedChange={() =>
													isLoaded && toggleSlide(slide.path)
												}
												className="shadow-sm data-[state=unchecked]:bg-white"
											/>
										</div>

										{/* 幻灯片缩略图 */}
										<div className="flex h-[160px] items-center justify-center overflow-hidden rounded-t-md bg-muted p-1">
											{slide.thumbnailUrl ? (
												<img
													src={slide.thumbnailUrl}
													alt={slide.title || `Slide ${index + 1}`}
													className="max-h-full max-w-full object-contain"
													style={{
														aspectRatio: `${slideDimensions.width} / ${slideDimensions.height}`,
													}}
													data-testid="slide-selection-dialog-image"
												/>
											) : (
												<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
													{slide.thumbnailLoading
														? t("ppt.loading")
														: t("ppt.fileNotFound")}
												</div>
											)}
										</div>

										{/* 幻灯片信息 */}
										<div className="border-t p-2">
											<div className="truncate text-xs font-medium">
												{slide.path.split("/").pop() ||
													`Slide ${index + 1}`}
											</div>
											<div className="text-xs text-muted-foreground">
												{t("ppt.pageNumber", { page: index + 1 })}
												{hiddenPaths.has(slide.path) && (
													<span className="ml-2">
														{t("ppt.hiddenSlide")}
													</span>
												)}
											</div>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</ScrollArea>

				{/* 导出格式选择 */}
				<div className="shrink-0 border-b px-4 py-3">
					<Label className="mb-2 text-sm font-medium">{t("ppt.exportFormat")}</Label>
					<RadioGroup
						value={exportFormat}
						onValueChange={(value) => setExportFormat(value as ExportFormat)}
						className="mt-2 flex flex-wrap gap-x-4 gap-y-2"
					>
						{supportPptx && (
							<>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="pptx" id="format-pptx" />
									<Label
										htmlFor="format-pptx"
										className="flex cursor-pointer items-center gap-2 text-sm font-normal"
									>
										<TSIcon type="ts-ppt-file" size="16" />
										{t("topicFiles.exportPptx")}
									</Label>
								</div>
							</>
						)}
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="pdf" id="format-pdf" />
							<Label
								htmlFor="format-pdf"
								className="flex cursor-pointer items-center gap-2 text-sm font-normal"
							>
								<TSIcon type="ts-pdf-file" size="16" />
								{t("topicFiles.pdf")}
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="source" id="format-source" />
							<Label
								htmlFor="format-source"
								className="flex cursor-pointer items-center gap-2 text-sm font-normal"
							>
								<FileSlicesIcon size={16} />
								{t("topicFiles.source")}
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="image_png" id="format-image-png" />
							<Label
								htmlFor="format-image-png"
								className="flex cursor-pointer items-center gap-2 text-sm font-normal"
							>
								<ImageIcon size={16} />
								{t("topicFiles.exportImagePng")}
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="image_jpeg" id="format-image-jpeg" />
							<Label
								htmlFor="format-image-jpeg"
								className="flex cursor-pointer items-center gap-2 text-sm font-normal"
							>
								<ImageIcon size={16} />
								{t("topicFiles.exportImageJpeg")}
							</Label>
						</div>
					</RadioGroup>
				</div>

				<DialogFooter className="shrink-0">
					<Button variant="outline" onClick={handleClose} disabled={isExporting}>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={selectedPaths.length === 0 || isExporting}
					>
						{isExporting
							? t("topicFiles.exporting")
							: t("ppt.exportSelected") + ` (${selectedPaths.length})`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default observer(SlideSelectionDialog)
