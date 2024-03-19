import { useState, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/opensource/components/shadcn-ui/radio-group"
import { Label } from "@/opensource/components/shadcn-ui/label"
import { cn } from "@/opensource/lib/utils"
import { Skeleton } from "@/opensource/components/shadcn-ui/skeleton"
import type { SlideItem } from "../PPTRender/PPTSidebar/types"
import { observer } from "mobx-react-lite"
import { TSIcon } from "@/opensource/components/base"
import FileSlicesIcon from "./FileSlicesIcon"

export type ExportFormat = "source" | "pdf" | "ppt" | "pptx"

interface SlideSelectionDialogProps {
	/** 是否打开对话框 */
	open: boolean
	/** 关闭对话框回调 */
	onOpenChange: (open: boolean) => void
	/** 所有幻灯片列表 */
	slides: SlideItem[]
	/** 确认导出回调，传递选中的 filePaths 和导出格式 */
	onConfirm: (filePaths: string[], format: ExportFormat) => void
	/** 是否正在导出 */
	isExporting?: boolean
	/** 生成截图回调 */
	onGenerateScreenshot?: (index: number) => Promise<void>
	/** 是否支持导出PPT */
	supportPPT?: boolean
}

function SlideSelectionDialog({
	open,
	onOpenChange,
	slides,
	onConfirm,
	isExporting = false,
	onGenerateScreenshot,
	supportPPT = true,
}: SlideSelectionDialogProps) {
	const { t } = useTranslation("super")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [exportFormat, setExportFormat] = useState<ExportFormat>(supportPPT ? "pptx" : "pdf")
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

	// 计算是否全选
	const isAllSelected = useMemo(() => {
		if (slides.length === 0) return false
		return slides.every((slide) => selectedIds.has(slide.path))
	}, [slides, selectedIds])

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

	// 全选/取消全选
	function toggleSelectAll() {
		if (isAllSelected) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(slides.map((slide) => slide.path)))
		}
	}

	// 确认导出
	function handleConfirm() {
		const fileIds = Array.from(selectedIds)
		if (fileIds.length === 0) {
			// 提示用户至少选择一页
			return
		}
		onConfirm(fileIds, exportFormat)
	}

	// 重置选择并关闭
	function handleClose() {
		setSelectedIds(new Set())
		setExportFormat(supportPPT ? "ppt" : "pdf")
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] w-fit !max-w-[unset] flex-col">
				<DialogHeader>
					<DialogTitle>{t("ppt.selectSlidesToExport")}</DialogTitle>
					<DialogDescription>
						{selectedIds.size > 0
							? t("ppt.selectedCount", { count: selectedIds.size })
							: t("ppt.pleaseSelectSlides")}
					</DialogDescription>
				</DialogHeader>

				{/* 全选/取消全选按钮 */}
				<div className="flex items-center gap-2 border-b pb-2">
					<Button
						variant="outline"
						size="sm"
						onClick={toggleSelectAll}
						className="h-8 text-sm"
					>
						<Checkbox checked={isAllSelected} className="bg-white shadow-sm" />
						{isAllSelected ? t("ppt.deselectAll") : t("ppt.selectAll")}
					</Button>
					<span className="text-sm text-muted-foreground">
						{t("ppt.exportAllSlides", { total: slides.length })}
					</span>
				</div>

				{/* 幻灯片网格：延后渲染，先出壳再出列表 */}
				<div className="min-h-[200px] flex-1 overflow-y-auto">
					{!contentReady ? (
						<div className="3xl:grid-cols-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
							{Array.from({ length: 8 }).map((_, i) => (
								<div
									key={i}
									className="relative h-[135px] w-[150px] rounded-lg border-2 border-border bg-card"
								>
									<div className="absolute left-2 top-2 z-10">
										<Skeleton className="size-4 rounded-sm" />
									</div>
									<Skeleton className="rounded-t-md" />
									<div className="space-y-1.5 border-t p-2">
										<Skeleton className="h-3.5 w-3/4 rounded" />
										<Skeleton className="h-3 w-1/2 rounded" />
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="3xl:grid-cols-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
							{slides.map((slide, index) => {
								const isSelected = selectedIds.has(slide.path)
								return (
									<div
										key={slide.id}
										onClick={() => toggleSlide(slide.path)}
										className={cn(
											"w-30 relative cursor-pointer rounded-lg border-2 transition-all hover:shadow-md",
											isSelected
												? "border-primary bg-primary/5 shadow-sm"
												: "border-border hover:border-primary/50",
										)}
									>
										{/* 选择框 */}
										<div className="absolute left-2 top-2 z-10">
											<Checkbox
												checked={isSelected}
												onCheckedChange={() => toggleSlide(slide.path)}
												className="bg-white shadow-sm"
											/>
										</div>

										{/* 幻灯片缩略图 */}
										<div className="aspect-[16/9] overflow-hidden rounded-t-md bg-muted">
											{slide.thumbnailUrl ? (
												<img
													src={slide.thumbnailUrl}
													alt={slide.title || `Slide ${index + 1}`}
													className="h-full w-full object-cover"
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
											</div>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>

				{/* 导出格式选择 */}
				<div className="border-b px-4 py-3">
					<Label className="mb-2 text-sm font-medium">{t("ppt.exportFormat")}</Label>
					<RadioGroup
						value={exportFormat}
						onValueChange={(value) => setExportFormat(value as ExportFormat)}
						className="mt-2 flex flex-wrap gap-x-4 gap-y-2"
					>
						{supportPPT && (
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
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="ppt" id="format-ppt" />
									<Label
										htmlFor="format-ppt"
										className="flex cursor-pointer items-center gap-2 text-sm font-normal"
									>
										<TSIcon type="ts-ppt-file" size="16" />
										{t("topicFiles.ppt")}
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
					</RadioGroup>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isExporting}>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={selectedIds.size === 0 || isExporting}
					>
						{isExporting
							? t("topicFiles.exporting")
							: t("ppt.exportSelected") + ` (${selectedIds.size})`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default observer(SlideSelectionDialog)
