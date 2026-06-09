import { useTranslation } from "react-i18next"
import { useMemo, useRef, useState, useEffect, type MouseEvent } from "react"
import { Check, Maximize, Minimize2 } from "lucide-react"
import { MagicTooltip } from "@/components/base"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../../contents/HTML/IsolatedHTMLRenderer"
import { resolvePptScaleContentDimensions } from "../../../contents/HTML/utils/slide-dimensions"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import { cn } from "@/lib/utils"

/** Placement for the shared history version dropdown */
type HistoryVersionSelectorPlacement = "compare" | "fullscreen"

interface HistoryVersionSelectorOptions {
	placement: HistoryVersionSelectorPlacement
	/** Stop click from bubbling to the compare column selection handler */
	stopPropagationOnSelect?: boolean
}

interface HistoryVersionCompareDialogProps {
	/** 弹窗是否打开 */
	open: boolean
	/** 关闭弹窗回调 */
	onOpenChange: (open: boolean) => void
	/** 最新版本内容 */
	latestContent: string
	/** 历史版本内容 */
	historyContent: string
	/** 历史版本号 */
	historyVersion: number
	/** 版本列表 */
	fileVersionsList: FileHistoryVersion[]
	/** 选择使用历史版本的回调 */
	onUseHistoryVersion: (version: number) => void
	/** 选择使用最新版本的回调 */
	onUseLatestVersion: () => void
	/** 切换历史版本回调 */
	onSwitchHistoryVersion: (version: number) => Promise<void>
	/** 文件路径映射 */
	filePathMapping: Map<string, string>
	/** 文件 ID */
	fileId?: string
	/** 打开新标签页回调 */
	openNewTab: (fileId: string, path: string) => void
	/** 选中的项目 */
	selectedProject?: Record<string, unknown> | null
	/** 附件列表 */
	attachmentList?: Array<Record<string, unknown>>
	isPptRender?: boolean
}

/** Shared styles for compare column headers; fixed height matches version select + fullscreen button row */
const COMPARE_COLUMN_HEADER_CLASS =
	"flex h-11 shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 shadow-sm"
const COMPARE_COLUMN_LABEL_CLASS = "text-sm font-normal text-foreground"
/** Width reserved on the latest column so both headers align with history controls */
const COMPARE_COLUMN_HEADER_ACTIONS_CLASS = "flex h-7 shrink-0 items-center gap-1"
/** Preview pane only; column outer border-2 already frames the selection — no inner border */
const COMPARE_PREVIEW_PANEL_CLASS =
	"flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-white dark:bg-card"

/**
 * 历史版本对比弹窗
 * 用于对比当前最新版本和选中的历史版本
 */
function HistoryVersionCompareDialog({
	open,
	onOpenChange,
	latestContent,
	historyContent,
	historyVersion,
	fileVersionsList,
	onUseHistoryVersion,
	onUseLatestVersion,
	onSwitchHistoryVersion,
	filePathMapping,
	fileId,
	openNewTab,
	selectedProject,
	attachmentList,
	isPptRender = true,
}: HistoryVersionCompareDialogProps) {
	const { t } = useTranslation("super")

	const latestVersionRendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const historyVersionRendererRef = useRef<IsolatedHTMLRendererRef>(null)

	const [selectedVersion, setSelectedVersion] = useState<"latest" | "history">("history")
	const [currentHistoryVersion, setCurrentHistoryVersion] = useState<number>(historyVersion)
	const [historyFullscreenOpen, setHistoryFullscreenOpen] = useState(false)
	const [isSwitchingHistory, setIsSwitchingHistory] = useState(false)
	const wasOpenRef = useRef(false)
	const latestScaleContentDimensions = useMemo(
		() => resolvePptScaleContentDimensions(latestContent),
		[latestContent],
	)
	const historyScaleContentDimensions = useMemo(
		() => resolvePptScaleContentDimensions(historyContent),
		[historyContent],
	)

	// Reset UI only when the dialog transitions from closed to open
	useEffect(() => {
		const justOpened = open && !wasOpenRef.current
		wasOpenRef.current = open

		if (!open) {
			setHistoryFullscreenOpen(false)
			setIsSwitchingHistory(false)
			return
		}

		if (!justOpened) return

		setSelectedVersion("history")
		setCurrentHistoryVersion(historyVersion)
		setHistoryFullscreenOpen(false)
		setIsSwitchingHistory(false)
	}, [open, historyVersion])

	const historyVersions = fileVersionsList.filter((_, index) => index > 0)
	// Only gate on in-flight switch; avoid unmounting iframe on version prop lag (causes blank PPT preview)
	const isHistoryContentPending = isSwitchingHistory

	/** Switch history version from compare column or fullscreen header dropdown */
	const handleHistoryVersionChange = async (version: string) => {
		const versionNumber = parseInt(version, 10)
		const previousHistoryVersion = currentHistoryVersion

		setCurrentHistoryVersion(versionNumber)
		setSelectedVersion("history")
		setIsSwitchingHistory(true)

		try {
			await onSwitchHistoryVersion(versionNumber)
		} catch (error) {
			console.error("Failed to switch history version:", error)
			setCurrentHistoryVersion(previousHistoryVersion)
		} finally {
			setIsSwitchingHistory(false)
		}
	}

	/** Confirm which side (latest vs history) to keep */
	const handleConfirm = () => {
		if (selectedVersion === "history") {
			onUseHistoryVersion(currentHistoryVersion)
		} else {
			onUseLatestVersion()
		}
		onOpenChange(false)
	}

	/** Cancel + confirm buttons in dialog footer (compare and fullscreen) */
	const renderCompareDialogActions = () => (
		<>
			<button
				type="button"
				data-testid="ppt-history-version-compare-dialog-cancel"
				className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
				onClick={() => onOpenChange(false)}
			>
				{t("common.cancel")}
			</button>
			<button
				type="button"
				data-testid="ppt-history-version-compare-dialog-confirm"
				className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				onClick={handleConfirm}
			>
				{selectedVersion === "history"
					? t("ppt.versionCompare.rollbackToHistory")
					: t("ppt.versionCompare.keepCurrent")}
			</button>
		</>
	)

	/** Shared history-only version dropdown; compare + fullscreen share currentHistoryVersion */
	const renderHistoryVersionSelector = ({
		placement,
		stopPropagationOnSelect = false,
	}: HistoryVersionSelectorOptions) => {
		const isFullscreenPlacement = placement !== "compare"
		const triggerTestId =
			placement === "compare"
				? "history-version-compare-version-select"
				: "history-version-fullscreen-version-select"
		// size="sm" + data-[size=sm]:h-6: override SelectTrigger default h-9 (data-[size=default]:h-9 wins over bare h-7)
		const triggerClassName =
			"h-6 min-h-6 w-[108px] px-2 py-0 text-xs data-[size=sm]:h-6 [&_svg]:size-3.5"

		return (
			<Select
				value={currentHistoryVersion.toString()}
				onValueChange={handleHistoryVersionChange}
			>
				<SelectTrigger
					size="sm"
					className={cn(
						triggerClassName,
						"border-border bg-muted/60 font-normal text-foreground shadow-none hover:bg-muted",
					)}
					data-testid={triggerTestId}
					onClick={
						stopPropagationOnSelect ? (event) => event.stopPropagation() : undefined
					}
				>
					<SelectValue>
						<span className="font-mono tabular-nums">v{currentHistoryVersion}</span>
					</SelectValue>
				</SelectTrigger>
				<SelectContent className={isFullscreenPlacement ? "!z-[1300]" : undefined}>
					{historyVersions.map((item) => (
						<SelectItem
							key={item.version}
							value={item.version.toString()}
							className="text-xs"
						>
							<div className="flex items-center gap-2">
								<span className="font-mono font-normal tabular-nums text-foreground">
									v{item.version}
								</span>
								<span className="text-muted-foreground">
									{item.edit_type === 1
										? t("common.onlineEdit")
										: t("common.aiEdit")}
								</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		)
	}

	/** Open fullscreen: expand history column in-place (same iframe, no remount) */
	const handleOpenHistoryFullscreen = (event: MouseEvent) => {
		event.stopPropagation()
		setHistoryFullscreenOpen(true)
	}

	/** Exit fullscreen: collapse history column back into compare layout */
	const handleCloseHistoryFullscreen = () => {
		setHistoryFullscreenOpen(false)
	}

	/**
	 * Single history iframe for compare + fullscreen; resizing retriggers scale instead of reload.
	 */
	const renderHistoryContentPanel = () => {
		const historyFileId = fileId ? `${fileId}-history` : undefined

		return (
			<div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
				<IsolatedHTMLRenderer
					key="history-compare"
					ref={historyVersionRendererRef}
					content={historyContent}
					rawSourceCode={historyContent}
					sandboxType="iframe"
					isPptRender={isPptRender}
					isFullscreen={historyFullscreenOpen}
					isEditMode={false}
					enableScalingHeightCalculation={isPptRender}
					scaleContentDimensions={isPptRender ? historyScaleContentDimensions : null}
					filePathMapping={filePathMapping}
					openNewTab={openNewTab}
					fileId={historyFileId}
					selectedProject={selectedProject}
					attachmentList={attachmentList}
					isVisible={true}
					hideVerticalScroll={isPptRender}
				/>
				{isHistoryContentPending && (
					<div
						className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-sm text-muted-foreground"
						data-testid="history-version-content-loading"
					>
						{t("common.loading")}
					</div>
				)}
			</div>
		)
	}

	return (
		<MagicModal
			open={open}
			onCancel={() => onOpenChange(false)}
			title={
				<div
					className={cn(
						"flex min-w-0 gap-4 pr-8",
						historyFullscreenOpen
							? "items-center justify-between"
							: "flex-wrap items-baseline gap-x-3 gap-y-1",
					)}
					data-testid="history-version-compare-dialog-title"
				>
					<div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
						<span className="shrink-0 text-base font-semibold leading-6 text-foreground">
							{t("ppt.versionCompare.historyTitle")}
						</span>
						<span className="min-w-0 text-xs font-normal leading-4 text-muted-foreground">
							{t("ppt.versionCompare.historyDescription")}
						</span>
					</div>
					{historyFullscreenOpen && (
						<div
							className="flex shrink-0 items-center gap-2"
							data-testid="history-version-fullscreen-header-actions"
						>
							{renderHistoryVersionSelector({ placement: "fullscreen" })}
							<MagicTooltip title={t("fileViewer.exitFullscreen")}>
								<span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 w-8 shrink-0 p-0 text-foreground"
										data-testid="history-version-fullscreen-close"
										onClick={handleCloseHistoryFullscreen}
										aria-label={t("fileViewer.exitFullscreen")}
									>
										<Minimize2 className="h-4 w-4" />
									</Button>
								</span>
							</MagicTooltip>
						</div>
					)}
				</div>
			}
			width="95vw"
			footer={null}
			closable={true}
			classNames={{
				body: "!p-0",
			}}
		>
			<div
				className="relative flex min-h-[72vh] flex-col"
				data-testid="ppt-history-version-compare-dialog"
			>
				<div className="relative flex min-h-0 flex-1 flex-col">
					<div
						className="relative flex h-[70vh] min-h-0 gap-4 overflow-hidden px-6 pt-3"
						data-testid="history-version-compare-columns"
					>
						{/* Left - latest version */}
						<div
							className={cn(
								"flex min-h-0 min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-lg border-2 p-2 transition-all",
								historyFullscreenOpen && "invisible",
								selectedVersion === "latest"
									? "border-primary bg-primary/5"
									: "border-transparent hover:border-border",
							)}
							onClick={() => setSelectedVersion("latest")}
							data-testid="history-version-compare-select-latest"
						>
							<div className={COMPARE_COLUMN_HEADER_CLASS}>
								<div className="flex min-w-0 items-center gap-2.5">
									<div
										className={cn(
											"flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
											selectedVersion === "latest"
												? "border-primary bg-primary"
												: "border-muted-foreground/50 bg-background",
										)}
									>
										{selectedVersion === "latest" && (
											<Check className="h-3 w-3 text-primary-foreground" />
										)}
									</div>
									<span className={COMPARE_COLUMN_LABEL_CLASS}>
										{t("common.latestVersion")}
									</span>
								</div>
								{/* Mirror history column controls width so preview panes start at the same offset */}
								<div
									className={cn(
										COMPARE_COLUMN_HEADER_ACTIONS_CLASS,
										"pointer-events-none opacity-0",
									)}
									aria-hidden
								>
									<div className="h-6 w-[108px]" />
									<div className="size-7" />
								</div>
							</div>
							<div className={COMPARE_PREVIEW_PANEL_CLASS}>
								<IsolatedHTMLRenderer
									key={`latest-${open}`}
									ref={latestVersionRendererRef}
									content={latestContent}
									rawSourceCode={latestContent}
									sandboxType="iframe"
									isPptRender={isPptRender}
									isEditMode={false}
									enableScalingHeightCalculation={isPptRender}
									scaleContentDimensions={
										isPptRender ? latestScaleContentDimensions : null
									}
									filePathMapping={filePathMapping}
									openNewTab={openNewTab}
									fileId={fileId ? `${fileId}-latest` : undefined}
									selectedProject={selectedProject}
									attachmentList={attachmentList}
									isVisible={true}
									hideVerticalScroll={isPptRender}
								/>
							</div>
						</div>

						{/* Right - history version; expands over columns when fullscreen (same iframe) */}
						<div
							className={cn(
								"flex min-h-0 min-w-0 flex-1 flex-col transition-all",
								historyFullscreenOpen
									? "absolute inset-0 z-[1100] gap-0 bg-background px-6 pb-3 pt-0"
									: "cursor-pointer gap-2 rounded-lg border-2 p-2",
								!historyFullscreenOpen &&
									(selectedVersion === "history"
										? "border-primary bg-primary/5"
										: "border-transparent hover:border-border"),
							)}
							onClick={() => {
								if (!historyFullscreenOpen) setSelectedVersion("history")
							}}
							data-testid="history-version-fullscreen-modal"
							data-fullscreen-active={historyFullscreenOpen ? "true" : "false"}
						>
							{!historyFullscreenOpen && (
								<div className={COMPARE_COLUMN_HEADER_CLASS}>
									<div className="flex flex-1 cursor-pointer items-center gap-2.5">
										<div
											className={cn(
												"flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
												selectedVersion === "history"
													? "border-primary bg-primary"
													: "border-muted-foreground/50 bg-background",
											)}
										>
											{selectedVersion === "history" && (
												<Check className="h-3 w-3 text-primary-foreground" />
											)}
										</div>
										<span className={COMPARE_COLUMN_LABEL_CLASS}>
											{t("common.historyVersion")}
										</span>
									</div>
									<div className={COMPARE_COLUMN_HEADER_ACTIONS_CLASS}>
										{renderHistoryVersionSelector({
											placement: "compare",
											stopPropagationOnSelect: true,
										})}
										<MagicTooltip title={t("fileViewer.fullscreen")}>
											<span>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0 text-foreground"
													data-testid="history-version-fullscreen-preview-button"
													onClick={handleOpenHistoryFullscreen}
													aria-label={t("fileViewer.fullscreen")}
												>
													<Maximize className="h-4 w-4" />
												</Button>
											</span>
										</MagicTooltip>
									</div>
								</div>
							)}
							<div className={COMPARE_PREVIEW_PANEL_CLASS}>
								{renderHistoryContentPanel()}
							</div>
						</div>
					</div>
				</div>

				<div
					className="relative z-[1200] flex shrink-0 justify-end gap-2 bg-background px-6 py-3"
					data-testid="history-version-compare-dialog-footer"
				>
					{renderCompareDialogActions()}
				</div>
			</div>
		</MagicModal>
	)
}

export default HistoryVersionCompareDialog
