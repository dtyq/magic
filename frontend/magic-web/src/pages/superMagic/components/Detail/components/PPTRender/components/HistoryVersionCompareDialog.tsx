import { useTranslation } from "react-i18next"
import { useRef, useState, useEffect } from "react"
import { Check } from "lucide-react"
import MagicModal from "@/components/base/MagicModal"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../../contents/HTML/IsolatedHTMLRenderer"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"

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
	selectedProject?: Record<string, unknown>
	/** 附件列表 */
	attachmentList?: Array<Record<string, unknown>>
}

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
}: HistoryVersionCompareDialogProps) {
	const { t } = useTranslation("super")

	// 渲染器引用
	const latestVersionRendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const historyVersionRendererRef = useRef<IsolatedHTMLRendererRef>(null)

	// 选中的版本 - 'latest' 或 'history'，默认选中历史版本
	const [selectedVersion, setSelectedVersion] = useState<"latest" | "history">("history")
	// 当前选中的历史版本号
	const [currentHistoryVersion, setCurrentHistoryVersion] = useState<number>(historyVersion)

	// 当弹窗打开时重置状态
	useEffect(() => {
		if (open) {
			setSelectedVersion("history")
			setCurrentHistoryVersion(historyVersion)
		}
	}, [open, historyVersion])

	// 处理历史版本切换
	const handleHistoryVersionChange = async (version: string) => {
		const versionNumber = parseInt(version, 10)
		setCurrentHistoryVersion(versionNumber)
		await onSwitchHistoryVersion(versionNumber)
	}

	// 处理确认操作
	const handleConfirm = () => {
		if (selectedVersion === "history") {
			onUseHistoryVersion(currentHistoryVersion)
		} else {
			onUseLatestVersion()
		}
		onOpenChange(false)
	}

	// 获取历史版本列表（排除最新版本）
	const historyVersions = fileVersionsList.filter((_, index) => index > 0)

	return (
		<MagicModal
			open={open}
			onCancel={() => onOpenChange(false)}
			title={t("ppt.versionCompare.historyTitle")}
			width="95vw"
			footer={null}
			closable={true}
			classNames={{
				body: "!p-0",
			}}
		>
			<div className="flex flex-col gap-3" data-testid="ppt-history-version-compare-dialog">
				<p className="mt-3 px-6 text-sm text-muted-foreground">
					{t("ppt.versionCompare.historyDescription")}
				</p>

				<div className="flex h-[65vh] gap-4 overflow-hidden px-6">
					{/* 左侧 - 最新版本 */}
					<div
						className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-lg border-2 p-2 transition-all ${selectedVersion === "latest"
								? "border-primary bg-primary/5"
								: "border-transparent hover:border-border"
							}`}
						onClick={() => setSelectedVersion("latest")}
					>
						<div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
							<div className="flex items-center gap-2">
								<div
									className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${selectedVersion === "latest"
											? "border-primary bg-primary"
											: "border-muted-foreground/30"
										}`}
								>
									{selectedVersion === "latest" && (
										<Check className="h-3 w-3 text-primary-foreground" />
									)}
								</div>
								<span className="text-sm font-medium">
									{t("common.latestVersion")}
								</span>
							</div>
						</div>
						<div className="flex-1 overflow-hidden rounded-md border bg-white dark:bg-card">
							<IsolatedHTMLRenderer
								key={`latest-${open}`}
								ref={latestVersionRendererRef}
								content={latestContent}
								sandboxType="iframe"
								isPptRender={true}
								isEditMode={false}
								filePathMapping={filePathMapping}
								openNewTab={openNewTab}
								fileId={fileId ? `${fileId}-latest` : undefined}
								selectedProject={selectedProject}
								attachmentList={attachmentList}
								isVisible={true}
							/>
						</div>
					</div>

					{/* 右侧 - 历史版本 */}
					<div
						className={`flex min-w-0 flex-1 flex-col gap-2 rounded-lg border-2 p-2 transition-all ${selectedVersion === "history"
								? "border-primary bg-primary/5"
								: "border-transparent hover:border-border"
							}`}
						onClick={() => setSelectedVersion("history")}
					>
						<div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
							<div className="flex flex-1 cursor-pointer items-center gap-2">
								<div
									className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${selectedVersion === "history"
											? "border-primary bg-primary"
											: "border-muted-foreground/30"
										}`}
								>
									{selectedVersion === "history" && (
										<Check className="h-3 w-3 text-primary-foreground" />
									)}
								</div>
								<span className="text-sm font-medium">
									{t("common.historyVersion")}
								</span>
							</div>
							{/* 版本选择器 */}
							<Select
								value={currentHistoryVersion.toString()}
								onValueChange={handleHistoryVersionChange}
							>
								<SelectTrigger className="h-7 w-[140px] text-xs">
									<SelectValue>
										<span className="flex items-center gap-1">
											<span>v{currentHistoryVersion}</span>
										</span>
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{historyVersions.map((item) => (
										<SelectItem
											key={item.version}
											value={item.version.toString()}
											className="text-xs"
										>
											<div className="flex items-center gap-2">
												<span>v{item.version}</span>
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
						</div>
						<div className="flex-1 overflow-hidden rounded-md border bg-white dark:bg-card">
							<IsolatedHTMLRenderer
								key={`history-${currentHistoryVersion}`}
								ref={historyVersionRendererRef}
								content={historyContent}
								sandboxType="iframe"
								isPptRender={true}
								isEditMode={false}
								filePathMapping={filePathMapping}
								openNewTab={openNewTab}
								fileId={fileId}
								selectedProject={selectedProject}
								attachmentList={attachmentList}
								isVisible={true}
							/>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 px-6 pb-4 pt-2">
					<button
						data-testid="ppt-history-version-compare-dialog-cancel"
						className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</button>
					<button
						data-testid="ppt-history-version-compare-dialog-confirm"
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						onClick={handleConfirm}
					>
						{selectedVersion === "history"
							? t("ppt.versionCompare.rollbackToHistory")
							: t("ppt.versionCompare.keepCurrent")}
					</button>
				</div>
			</div>
		</MagicModal>
	)
}

export default HistoryVersionCompareDialog
