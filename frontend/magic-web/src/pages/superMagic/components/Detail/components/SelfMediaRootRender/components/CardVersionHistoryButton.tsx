import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { History, Check, RotateCcw, ChevronDown } from "lucide-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { usePPTVersionManager } from "../../PPTRender/hooks/usePPTVersionManager"
import { processHtmlContent } from "../../../contents/HTML/htmlProcessor"
import { CardVersionCompareDialog } from "./CardVersionCompareDialog"
import { CARD_IMAGE_PROCESS } from "../constants/imageProcess"
import type { SelfMediaAttachmentNode } from "../types"

interface CardVersionHistoryButtonProps {
	/** 文件 ID */
	fileId: string
	/** 附件列表（用于路径替换处理） */
	attachmentList?: SelfMediaAttachmentNode[]
	className?: string
	testIdPrefix?: string
	/**
	 * 打开下拉前的拦截回调（例如：有未保存内容时弹框询问用户）。
	 * 返回 true 允许打开，返回 false 取消打开。
	 */
	onBeforeOpen?: () => Promise<boolean>
}

/**
 * 文章卡片版本历史按钮
 * 复用 PPT 版本管理逻辑（usePPTVersionManager + VersionHistorySelector 风格的下拉），
 * 点击历史版本打开 CardVersionCompareDialog 进行对比。
 */
export function CardVersionHistoryButton({
	fileId,
	attachmentList,
	className,
	testIdPrefix = "card-version-history",
	onBeforeOpen,
}: CardVersionHistoryButtonProps) {
	const { t } = useTranslation("super")
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [compareDialogOpen, setCompareDialogOpen] = useState(false)
	const [compareHistoryVersion, setCompareHistoryVersion] = useState<number | undefined>(
		undefined,
	)
	const [compareHistoryContent, setCompareHistoryContent] = useState<string>("")

	const {
		fileVersionsList,
		fetchFileVersions,
		getVersionContentForCompare,
		handleVersionRollback,
	} = usePPTVersionManager({ fileId })

	const hasHistoryVersion = fileVersionsList.length > 0

	/** 处理历史版本 HTML，进行路径替换以确保资源可访问 */
	const processVersionContent = useMemoizedFn(async (rawContent: string): Promise<string> => {
		if (!attachmentList?.length) return rawContent
		try {
			const result = await processHtmlContent({
				content: rawContent,
				attachments: attachmentList,
				attachmentList,
				fileId,
				xMagicImageProcess: CARD_IMAGE_PROCESS,
			})
			return result.processedContent || rawContent
		} catch {
			return rawContent
		}
	})

	/** 点击历史版本：获取内容并打开对比弹窗 */
	const handleVersionItemClick = useMemoizedFn(async (version: number) => {
		setDropdownOpen(false)
		const raw = await getVersionContentForCompare(version)
		if (!raw) return
		const processed = await processVersionContent(raw)
		setCompareHistoryVersion(version)
		setCompareHistoryContent(processed)
		setCompareDialogOpen(true)
	})

	/** 在对比弹窗内切换历史版本 */
	const handleSwitchHistoryVersion = useMemoizedFn(async (version: number) => {
		const raw = await getVersionContentForCompare(version)
		if (!raw) return
		const processed = await processVersionContent(raw)
		setCompareHistoryVersion(version)
		setCompareHistoryContent(processed)
	})

	/** 使用历史版本（回滚） */
	const handleUseHistoryVersion = useMemoizedFn(async (version: number) => {
		await handleVersionRollback(version)
		setCompareDialogOpen(false)
	})

	/** 使用最新版本（关闭弹窗，不操作） */
	const handleUseLatestVersion = useMemoizedFn(() => {
		setCompareDialogOpen(false)
	})

	return (
		<>
			<DropdownMenu
				open={dropdownOpen}
				onOpenChange={async (open) => {
					if (!open) {
						setDropdownOpen(false)
						return
					}
					if (onBeforeOpen) {
						const allowed = await onBeforeOpen()
						if (!allowed) return
					}
					fetchFileVersions(fileId)
					setDropdownOpen(true)
				}}
			>
				<DropdownMenuTrigger asChild>
					<span>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									data-testid={`${testIdPrefix}-trigger`}
									className={cn(
										"flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground",
										className,
									)}
								>
									<History className="h-4 w-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">
								{t("common.historyVersion")}
							</TooltipContent>
						</Tooltip>
					</span>
				</DropdownMenuTrigger>

				<DropdownMenuContent side="right" align="start" className="min-w-[280px]">
					<DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
						<History size={14} />
						{t("common.historyVersion")}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					{!hasHistoryVersion ? (
						<div className="px-2 py-6 text-center text-xs text-muted-foreground">
							{t("common.noHistoryVersionHint")}
						</div>
					) : (
						<>
							{fileVersionsList.map((item, index) => {
								const isLatest = index === 0
								if (isLatest) return null // 最新版本无需对比

								return (
									<DropdownMenuItem
										key={item.version}
										onClick={() => handleVersionItemClick(item.version)}
										data-testid={`${testIdPrefix}-version-${item.version}`}
										className="flex items-start gap-3 px-3 py-2"
									>
										<div className="flex flex-1 flex-col gap-1">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">
													{t("common.historyVersion")}
												</span>
												<span className="rounded bg-muted px-1.5 py-0.5 text-xs">
													v{item.version}
												</span>
												<span className="rounded bg-muted px-1.5 py-0.5 text-xs">
													{item.edit_type === 1
														? t("common.onlineEdit")
														: t("common.aiEdit")}
												</span>
											</div>
											<div className="text-xs text-muted-foreground">
												{item.created_at}
											</div>
										</div>
									</DropdownMenuItem>
								)
							})}

							{fileVersionsList.length >= 10 && (
								<>
									<DropdownMenuSeparator />
									<div className="px-3 py-2 text-xs text-muted-foreground">
										{t("common.versionsLimitHint")}
									</div>
								</>
							)}
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{compareHistoryVersion !== undefined && (
				<CardVersionCompareDialog
					open={compareDialogOpen}
					onOpenChange={setCompareDialogOpen}
					fileId={fileId}
					historyContent={compareHistoryContent}
					historyVersion={compareHistoryVersion}
					fileVersionsList={fileVersionsList}
					attachmentList={attachmentList}
					onUseHistoryVersion={handleUseHistoryVersion}
					onUseLatestVersion={handleUseLatestVersion}
					onSwitchHistoryVersion={handleSwitchHistoryVersion}
				/>
			)}
		</>
	)
}
