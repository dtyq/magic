import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import MagicModal from "@/components/base/MagicModal"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import CardFrame from "./CardFrame"
import type { SelfMediaAttachmentNode } from "../types"

interface CardVersionCompareDialogProps {
	/** 弹窗是否打开 */
	open: boolean
	/** 关闭弹窗回调 */
	onOpenChange: (open: boolean) => void
	/** 当前文件 ID（用于显示最新版本） */
	fileId: string
	/** 历史版本内容（已处理的 HTML） */
	historyContent: string
	/** 历史版本号 */
	historyVersion: number
	/** 版本列表 */
	fileVersionsList: FileHistoryVersion[]
	/** 附件列表（用于 CardFrame） */
	attachmentList?: SelfMediaAttachmentNode[]
	/** 选择使用历史版本的回调 */
	onUseHistoryVersion: (version: number) => void
	/** 选择使用最新版本的回调 */
	onUseLatestVersion: () => void
	/** 切换历史版本回调 */
	onSwitchHistoryVersion: (version: number) => Promise<void>
}

/**
 * 文章卡片历史版本对比弹窗
 * 左侧展示最新版本（复用 CardFrame），右侧展示选中的历史版本（iframe srcdoc）
 */
export function CardVersionCompareDialog({
	open,
	onOpenChange,
	fileId,
	historyContent,
	historyVersion,
	fileVersionsList,
	attachmentList,
	onUseHistoryVersion,
	onUseLatestVersion,
	onSwitchHistoryVersion,
}: CardVersionCompareDialogProps) {
	const { t } = useTranslation("super")

	const [selectedSide, setSelectedSide] = useState<"latest" | "history">("history")
	const [currentHistoryVersion, setCurrentHistoryVersion] = useState<number>(historyVersion)

	useEffect(() => {
		if (open) {
			setSelectedSide("history")
			setCurrentHistoryVersion(historyVersion)
		}
	}, [open, historyVersion])

	const handleHistoryVersionChange = async (version: string) => {
		const versionNumber = parseInt(version, 10)
		setCurrentHistoryVersion(versionNumber)
		await onSwitchHistoryVersion(versionNumber)
	}

	const handleConfirm = () => {
		if (selectedSide === "history") {
			onUseHistoryVersion(currentHistoryVersion)
		} else {
			onUseLatestVersion()
		}
		onOpenChange(false)
	}

	// 排除最新版本，只展示历史版本供切换
	const historyVersions = fileVersionsList.filter((_, index) => index > 0)

	return (
		<MagicModal
			open={open}
			onCancel={() => onOpenChange(false)}
			title={t("ppt.versionCompare.historyTitle")}
			width="95vw"
			footer={null}
			closable={true}
			classNames={{ body: "!p-0" }}
		>
			<div className="flex flex-col gap-3" data-testid="card-history-version-compare-dialog">
				<p className="mt-3 px-6 text-sm text-muted-foreground">
					{t("ppt.versionCompare.historyDescription")}
				</p>

				<div className="flex h-[65vh] gap-4 overflow-hidden px-6">
					{/* 左侧 - 最新版本（复用 CardFrame） */}
					<div
						className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-lg border-2 p-2 transition-all ${
							selectedSide === "latest"
								? "border-primary bg-primary/5"
								: "border-transparent hover:border-border"
						}`}
						onClick={() => setSelectedSide("latest")}
					>
						<div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5">
							<div
								className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
									selectedSide === "latest"
										? "border-primary bg-primary"
										: "border-muted-foreground/30"
								}`}
							>
								{selectedSide === "latest" && (
									<Check className="h-3 w-3 text-primary-foreground" />
								)}
							</div>
							<span className="text-sm font-medium">{t("common.latestVersion")}</span>
						</div>
						<div className="flex-1 overflow-hidden rounded-md border bg-white dark:bg-card">
							<CardFrame
								cardId={`card-compare-latest-${fileId}-${open}`}
								fileId={fileId}
								attachmentList={attachmentList}
								className="h-full w-full"
							/>
						</div>
					</div>

					{/* 右侧 - 历史版本（iframe srcdoc） */}
					<div
						className={`flex min-w-0 flex-1 flex-col gap-2 rounded-lg border-2 p-2 transition-all ${
							selectedSide === "history"
								? "border-primary bg-primary/5"
								: "border-transparent hover:border-border"
						}`}
						onClick={() => setSelectedSide("history")}
					>
						<div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
							<div className="flex flex-1 cursor-pointer items-center gap-2">
								<div
									className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
										selectedSide === "history"
											? "border-primary bg-primary"
											: "border-muted-foreground/30"
									}`}
								>
									{selectedSide === "history" && (
										<Check className="h-3 w-3 text-primary-foreground" />
									)}
								</div>
								<span className="text-sm font-medium">
									{t("common.historyVersion")}
								</span>
							</div>
							{historyVersions.length > 0 && (
								<Select
									value={currentHistoryVersion.toString()}
									onValueChange={handleHistoryVersionChange}
								>
									<SelectTrigger className="h-7 w-[140px] text-xs">
										<SelectValue>
											<span>v{currentHistoryVersion}</span>
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
							)}
						</div>
						<div className="flex-1 overflow-hidden rounded-md border bg-white dark:bg-card">
							{historyContent ? (
								<iframe
									key={currentHistoryVersion}
									srcDoc={historyContent}
									sandbox="allow-scripts allow-same-origin"
									className="h-full w-full border-0"
									title={`${t("common.historyVersion")} v${currentHistoryVersion}`}
								/>
							) : (
								<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
									{t("common.loading")}
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 px-6 pb-4 pt-2">
					<button
						data-testid="card-history-compare-cancel"
						className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</button>
					<button
						data-testid="card-history-compare-confirm"
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						onClick={handleConfirm}
					>
						{selectedSide === "history"
							? t("ppt.versionCompare.useHistoryVersion")
							: t("ppt.versionCompare.useLatestVersion")}
					</button>
				</div>
			</div>
		</MagicModal>
	)
}
