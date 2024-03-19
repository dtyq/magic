import { memo } from "react"
import { IconChevronRight } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { format, addDays } from "date-fns"
import { cn } from "@/opensource/lib/utils"
import { ShareType } from "../types"
import type { ShareResourceApiItem } from "../../ShareManagement/types"
import { getShareTypeIcon } from "../../ShareManagement/utils/shareTypeHelpers"
import { Separator } from "@/opensource/components/shadcn-ui/separator"

interface SimilarShareItemProps {
	item: ShareResourceApiItem
	onClick?: (item: ShareResourceApiItem) => void
	showStats?: boolean // 是否显示统计信息（访问次数、复制次数）
}

function SimilarShareItem({ item, onClick, showStats = false }: SimilarShareItemProps) {
	const { t } = useTranslation("super")

	// 获取分享类型文本
	const getShareTypeText = (type: ShareType) => {
		if (type === ShareType.Public) return t("share.publicAccess")
		if (type === ShareType.PasswordProtected) return t("share.passwordProtected")
		if (type === ShareType.Organization) return t("share.teamShare")
		return ""
	}

	// 获取分享类型标签背景色
	const getShareTypeBgColor = (type: ShareType) => {
		if (type === ShareType.Public) {
			return "bg-sky-50"
		}
		if (type === ShareType.PasswordProtected) {
			return "bg-orange-50"
		}
		if (type === ShareType.Organization) {
			return "bg-indigo-50"
		}
		return "bg-muted"
	}

	// 获取分享类型标签文本颜色
	const getShareTypeTextColor = (type: ShareType) => {
		if (type === ShareType.Public) {
			return "text-sky-400"
		}
		if (type === ShareType.PasswordProtected) {
			return "text-orange-400"
		}
		if (type === ShareType.Organization) {
			return "text-indigo-400"
		}
		return "text-muted-foreground"
	}

	// 计算到期日期
	const getExpireInfo = () => {
		if (!item.expire_days) {
			return t("share.permanent")
		}
		try {
			const expireDate = new Date(item.expire_at as string)
			const formattedDate = format(expireDate, "yyyy/MM/dd HH:mm")
			return `${t("shareManagement.validUntil", {
				days: item.expire_days,
				date: formattedDate,
			})}`
		} catch {
			return t("share.permanent")
		}
	}

	const fileCount = item.extend?.file_count || 0
	const viewCount = item.view_count ?? 0
	const copyCount = item.extend?.copy_count ?? 0

	return (
		<div
			className="flex cursor-pointer gap-2 p-2 transition-colors"
			style={{
				borderRadius: "var(--border-radius-rounded-md, 8px)",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = "var(--base-sidebar-accent, #F5F5F5)"
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = "transparent"
			}}
			onClick={() => onClick?.(item)}
		>
			{/* 分享类型图标 */}
			<div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
				{getShareTypeIcon(item.share_type)}
			</div>

			{/* 内容区域 */}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{/* 标题和标签 */}
				<div className="flex flex-wrap items-center gap-2">
					<span className="truncate text-sm font-medium leading-none">
						{item.resource_name}
					</span>
					{/* 分享类型标签 */}
					<div
						className={cn(
							"flex items-center justify-center rounded-full px-2 py-1",
							getShareTypeBgColor(item.share_type),
						)}
					>
						<span
							className={cn(
								"text-xs leading-none",
								getShareTypeTextColor(item.share_type),
							)}
						>
							{getShareTypeText(item.share_type)}
						</span>
					</div>
					{/* 项目名称标签 */}
					{item.project_name && (
						<div className="flex items-center justify-center rounded-full bg-muted px-2 py-1">
							<span className="text-xs leading-none text-muted-foreground">
								{item.project_name}
							</span>
						</div>
					)}
				</div>

				{/* 文件数量和有效期 */}
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>
						{fileCount} {t("share.fileCount")}
					</span>
					{showStats && (
						<>
							<Separator orientation="vertical" className="h-3" />
							<span>
								{viewCount} {t("share.viewCount")}
							</span>
							{copyCount > 0 && (
								<>
									<Separator orientation="vertical" className="h-3" />
									<span>
										{copyCount} {t("share.copyCount")}
									</span>
								</>
							)}
						</>
					)}
					{!showStats && (
						<>
							<Separator orientation="vertical" className="h-3" />
							<span>{getExpireInfo()}</span>
						</>
					)}
				</div>

				{/* 有效期（仅在显示统计信息时） */}
				{showStats && (
					<div className="text-xs text-muted-foreground">{getExpireInfo()}</div>
				)}
			</div>

			{/* 右侧箭头 */}
			<div className="flex flex-shrink-0 items-center justify-center opacity-70">
				<IconChevronRight size={16} />
			</div>
		</div>
	)
}

export default memo(SimilarShareItem)
