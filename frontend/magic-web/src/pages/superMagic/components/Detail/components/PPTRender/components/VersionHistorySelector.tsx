import { useState } from "react"
import { useTranslation } from "react-i18next"
import { History, Check, RotateCcw, ChevronDown } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import ConditionalTooltip from "../../EditToolbar/ConditionalTooltip"
import { TOOLBAR_Z_INDEX } from "../../../constants/z-index"

interface VersionHistorySelectorProps {
	fileId: string
	fileVersion?: number
	fileVersionsList: FileHistoryVersion[]
	isNewestVersion: boolean
	onVersionChange: (version: number | undefined) => void
	onRollback: (version?: number) => void
	fetchFileVersions: (fileId: string) => void
	disabled?: boolean
	showButtonText?: boolean
	/** 版本对比回调 */
	onCompareVersion?: (version: number) => void
}

export function VersionHistorySelector({
	fileId,
	fileVersion,
	fileVersionsList,
	isNewestVersion,
	onVersionChange,
	onRollback,
	fetchFileVersions,
	disabled = false,
	showButtonText = false,
	onCompareVersion,
}: VersionHistorySelectorProps) {
	const { t } = useTranslation("super")
	const [dropdownOpen, setDropdownOpen] = useState(false)

	const hasHistoryVersion = fileVersionsList && fileVersionsList.length > 0

	if (!fileId) {
		return null
	}

	// Handle version item click - compare for history, switch for latest
	const handleVersionItemClick = (version: number, isLatest: boolean) => {
		if (isLatest) {
			// 最新版本直接切换
			onVersionChange(undefined)
		} else {
			// 历史版本触发对比
			if (onCompareVersion) {
				onCompareVersion(version)
			}
		}
		setDropdownOpen(false)
	}

	// Handle version rollback
	const handleRollback = () => {
		if (!fileVersion) return
		onRollback(fileVersion)
		setDropdownOpen(false)
	}

	return (
		<DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
			<DropdownMenuTrigger asChild disabled={disabled}>
				<span>
					<ConditionalTooltip
						showText={showButtonText}
						title={t("common.historyVersion")}
					>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								fetchFileVersions(fileId)
							}}
							className="shadow-xs h-6 gap-1.5 rounded-md px-3 text-xs font-normal text-foreground"
						>
							<History size={16} />
							{showButtonText && <span>{t("common.historyVersion")}</span>}
							<ChevronDown size={16} />
						</Button>
					</ConditionalTooltip>
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="relative min-w-[280px]"
				style={{ zIndex: TOOLBAR_Z_INDEX.VERSION_HISTORY_DROPDOWN }}
			>
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
							const isSelected =
								item.version === fileVersion || (!fileVersion && index === 0)
							const isLatest = index === 0

							return (
								<DropdownMenuItem
									key={item.version}
									onClick={() => handleVersionItemClick(item.version, isLatest)}
									className={cn(
										"flex items-start gap-3 px-3 py-2",
										isSelected && "bg-accent",
									)}
								>
									<div className="flex flex-1 flex-col gap-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">
												{isLatest
													? t("common.latestVersion")
													: t("common.historyVersion")}
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
									{isSelected && (
										<Check size={16} className="mt-0.5 flex-shrink-0" />
									)}
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

						{fileVersion && !isNewestVersion && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={handleRollback}
									className="flex items-center gap-2 text-xs"
								>
									<RotateCcw size={14} />
									<span>{t("common.rollbackToVersion")}</span>
								</DropdownMenuItem>
							</>
						)}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
