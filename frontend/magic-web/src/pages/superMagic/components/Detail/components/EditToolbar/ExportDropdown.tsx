import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { DownloadIcon, MoreHorizontalIcon } from "lucide-react"
// import {
// 	DropdownMenu,
// 	DropdownMenuContent,
// 	DropdownMenuGroup,
// 	DropdownMenuItem,
// 	DropdownMenuLabel,
// 	DropdownMenuSeparator,
// 	DropdownMenuTrigger,
// } from "@/components/shadcn-ui/dropdown-menu"
import SlideSelectionDialog from "./SlideSelectionDialog"
import type { SlideItem } from "../PPTRender/PPTSidebar/types"
// import { TSIcon } from "@/components/base"
// import FileSlicesIcon from "./FileSlicesIcon"
import ActionButton from "../CommonHeader/components/ActionButton"
// import { TOOLBAR_Z_INDEX } from "../../constants/z-index"

interface ExportDropdownProps {
	/** 是否显示按钮文字 */
	showText?: boolean
	/** 是否禁用 */
	disabled?: boolean
	/** 是否正在导出 */
	isExporting?: boolean
	/** 是否支持导出PPT */
	supportPPT?: boolean
	/** 是否支持导出当前页面 */
	supportCurrentPage?: boolean
	/** 当前页面索引 */
	currentPageIndex?: number
	/** 总页数 */
	totalPages?: number
	/** 是否支持指定页面导出 */
	supportSpecificPages?: boolean
	/** 所有幻灯片列表（指定页面导出时需要） */
	slides?: SlideItem[]
	/** 导出源文件回调 */
	onExportSource?: () => void
	/** 导出PDF回调 */
	onExportPDF?: () => void
	/** 导出PPT回调 */
	onExportPPT?: () => void
	/** 导出PPT（可编辑）回调 */
	onExportEditablePPT?: () => void
	/** 导出当前页源文件回调 */
	onExportCurrentSource?: () => void
	/** 导出当前页PDF回调 */
	onExportCurrentPDF?: () => void
	/** 导出当前页PPT回调 */
	onExportCurrentPPT?: () => void
	/** 导出当前页PPT（可编辑）回调 */
	onExportCurrentEditablePPT?: () => void
	/** 指定页面导出回调，传递选中的 slide paths 和导出格式（pptx=可编辑 PPT，由 magic-web 决定内容后传包） */
	onExportSpecificPages?: (filePaths: string[], format: "source" | "pdf" | "ppt" | "pptx") => void
	/** 生成截图回调 */
	onGenerateScreenshot?: (index: number) => Promise<void>
}

function ExportDropdown({
	showText = true,
	disabled = false,
	isExporting = false,
	supportPPT = true,
	supportCurrentPage = false,
	supportSpecificPages = false,
	currentPageIndex,
	totalPages,
	slides = [],
	onExportSource,
	onExportPDF,
	onExportPPT,
	onExportEditablePPT,
	onExportCurrentSource,
	onExportCurrentPDF,
	onExportCurrentPPT,
	onExportCurrentEditablePPT,
	onExportSpecificPages,
	onGenerateScreenshot,
}: ExportDropdownProps) {
	const { t } = useTranslation("super")
	const [slideDialogOpen, setSlideDialogOpen] = useState(false)
	// const [menuOpen, setMenuOpen] = useState(false)

	const isDisabled = disabled || isExporting
	const hasCurrentPage =
		supportCurrentPage &&
		(onExportCurrentSource ||
			onExportCurrentPDF ||
			onExportCurrentPPT ||
			onExportCurrentEditablePPT) &&
		currentPageIndex !== undefined

	/* hover 菜单相关逻辑已暂时禁用，保留代码以便后续恢复
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const cancelCloseTimer = useCallback(() => {
		if (closeTimerRef.current != null) {
			clearTimeout(closeTimerRef.current)
			closeTimerRef.current = null
		}
	}, [])

	const scheduleClose = useCallback(() => {
		cancelCloseTimer()
		closeTimerRef.current = setTimeout(() => {
			setMenuOpen(false)
			closeTimerRef.current = null
		}, 150)
	}, [cancelCloseTimer])

	const openMenu = useCallback(() => {
		if (isDisabled) return
		cancelCloseTimer()
		setMenuOpen(true)
	}, [cancelCloseTimer, isDisabled])

	useEffect(() => cancelCloseTimer, [cancelCloseTimer])

	useEffect(() => {
		if (isDisabled) setMenuOpen(false)
	}, [isDisabled])
	*/

	const handlePrimaryClick = useCallback(() => {
		if (isDisabled) return
		// cancelCloseTimer()
		// setMenuOpen(false)
		setSlideDialogOpen(true)
	}, [isDisabled])

	function handleConfirmExport(filePaths: string[], format: "source" | "pdf" | "ppt" | "pptx") {
		if (onExportSpecificPages) {
			onExportSpecificPages(filePaths, format)
		}
		setSlideDialogOpen(false)
	}

	return (
		<>
			{/* 幻灯片选择对话框 */}
			{supportSpecificPages && onExportSpecificPages && (
				<SlideSelectionDialog
					open={slideDialogOpen}
					onOpenChange={setSlideDialogOpen}
					slides={slides}
					onConfirm={handleConfirmExport}
					isExporting={isExporting}
					onGenerateScreenshot={onGenerateScreenshot}
					supportPPT={supportPPT}
				/>
			)}
			{/* <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}> */}
			<div className="inline-flex items-center" data-testid="export-dropdown-trigger">
				{/* 左侧主按钮：点击直接打开指定页面对话框 */}
				<span onClick={handlePrimaryClick} data-testid="export-dropdown-primary">
					<ActionButton
						icon={<DownloadIcon className="h-4 w-4" />}
						title={t("ppt.download")}
						text={t("ppt.download")}
						showText={showText}
						disabled={isDisabled}
					/>
				</span>
				{/* 右侧 ⋯ 展开按钮：hover 显示导出菜单 */}
				{/* <DropdownMenuTrigger asChild>
						<span
							onMouseEnter={openMenu}
							onMouseLeave={scheduleClose}
							data-testid="export-dropdown-menu-trigger"
						>
							<ActionButton
								icon={<MoreHorizontalIcon className="h-4 w-4" />}
								title={t("ppt.download")}
								showText={false}
								disabled={isDisabled}
							/>
						</span>
					</DropdownMenuTrigger> */}
			</div>
			{/* <DropdownMenuContent
					align="start"
					className="w-[203px]"
					style={{ zIndex: TOOLBAR_Z_INDEX.DOWNLOAD_DROPDOWN }}
					onMouseEnter={cancelCloseTimer}
					onMouseLeave={scheduleClose}
				>
					当前幻灯片分组
					{hasCurrentPage && (
						<>
							<DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
								{t("ppt.exportCurrentSlide", { page: (currentPageIndex || 0) + 1 })}
							</DropdownMenuLabel>
							<DropdownMenuGroup>
								{onExportCurrentSource && (
									<DropdownMenuItem
										onClick={onExportCurrentSource}
										className="cursor-pointer px-2 py-1.5"
									>
										<FileSlicesIcon size={16} />
										<span className="text-sm">
											{t("topicFiles.exportSource")}
										</span>
									</DropdownMenuItem>
								)}
								{onExportCurrentPDF && (
									<DropdownMenuItem
										onClick={onExportCurrentPDF}
										className="cursor-pointer px-2 py-1.5"
									>
										<TSIcon type="ts-pdf-file" size="16" />
										<span className="text-sm">{t("topicFiles.exportPdf")}</span>
									</DropdownMenuItem>
								)}
								{supportPPT && onExportCurrentPPT && (
									<>
										<DropdownMenuItem
											onClick={onExportCurrentPPT}
											className="cursor-pointer px-2 py-1.5"
										>
											<TSIcon type="ts-ppt-file" size="16" />
											<span className="text-sm">
												{t("topicFiles.exportPpt")}
											</span>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={onExportCurrentEditablePPT}
											className="cursor-pointer px-2 py-1.5"
										>
											<TSIcon type="ts-ppt-file" size="16" />
											<span className="text-sm">
												{t("topicFiles.exportPptx")}
											</span>
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
						</>
					)}

					整个幻灯片分组
					{(onExportSource || onExportPDF || onExportPPT || onExportEditablePPT) && (
						<>
							<DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
								{t("ppt.exportAllSlides", { total: totalPages || 0 })}
							</DropdownMenuLabel>
							<DropdownMenuGroup>
								{onExportSource && (
									<DropdownMenuItem
										onClick={onExportSource}
										className="cursor-pointer px-2 py-1.5"
									>
										<FileSlicesIcon size={16} />
										<span className="text-sm">
											{t("topicFiles.exportSource")}
										</span>
									</DropdownMenuItem>
								)}
								{onExportPDF && (
									<DropdownMenuItem
										onClick={onExportPDF}
										className="cursor-pointer px-2 py-1.5"
									>
										<TSIcon type="ts-pdf-file" size="16" />
										<span className="text-sm">{t("topicFiles.exportPdf")}</span>
									</DropdownMenuItem>
								)}
								{supportPPT && onExportPPT && (
									<>
										<DropdownMenuItem
											onClick={onExportPPT}
											className="cursor-pointer px-2 py-1.5"
										>
											<TSIcon type="ts-ppt-file" size="16" />
											<span className="text-sm">
												{t("topicFiles.exportPpt")}
											</span>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={onExportEditablePPT}
											className="cursor-pointer px-2 py-1.5"
										>
											<TSIcon type="ts-ppt-file" size="16" />
											<span className="text-sm">
												{t("topicFiles.exportPptx")}
											</span>
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuGroup>
						</>
					)}
				</DropdownMenuContent> */}
			{/* </DropdownMenu> */}
		</>
	)
}

export default memo(ExportDropdown)
