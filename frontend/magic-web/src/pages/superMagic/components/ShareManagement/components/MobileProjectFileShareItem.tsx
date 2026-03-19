import { memo, useState, useCallback } from "react"
import { IconDots } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useResponsive } from "ahooks"
import { Dropdown, MenuProps } from "antd"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/shadcn-ui/badge"
import type { ProjectShareItem, FileShareItem } from "../types"
import ProjectNameBadge from "./ProjectNameBadge"
import {
	getShareTypeIcon,
	getShareTypeBadgeStyles,
	getShareTypeText,
	getRemainingDays,
	formatExpireAt,
	convertToShareItem,
} from "../utils/shareTypeHelpers"
import {
	ActionDrawer,
	ActionGroup,
	ActionItem,
} from "@/components/shadcn-composed/action-drawer"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import ShareSuccessModal from "../../Share/FileShareModal/ShareSuccessModal"
import { useShareItemActions } from "../hooks/useShareItemActions"
import { useShareSuccessModal } from "../hooks/useShareSuccessModal"
import SuperTooltip from "@/pages/superMagic/components/SuperTooltip"

interface MobileProjectFileShareItemProps {
	item: ProjectShareItem | FileShareItem
	onEdit?: (item: ProjectShareItem | FileShareItem) => void
	onCancelShare?: (item: ProjectShareItem | FileShareItem) => void
	disableProjectNavigation?: boolean // 是否禁用项目跳转
	showProjectBadge?: boolean // 是否显示项目名 Badge
}

function MobileProjectFileShareItem({
	item,
	onEdit,
	onCancelShare,
	disableProjectNavigation = false,
	showProjectBadge = true,
}: MobileProjectFileShareItemProps) {
	const { t } = useTranslation("super")
	const responsive = useResponsive()
	const isMobile = responsive.md === false
	const [showActions, setShowActions] = useState(false)

	// 使用 ShareSuccessModal hook
	const shareSuccessModal = useShareSuccessModal()

	// 获取分享类型 Badge 样式
	const badgeStyles = getShareTypeBadgeStyles(item.share_type)

	// 转换为ShareItem格式
	const shareItem = convertToShareItem(item, () => t("share.untitled"))

	// 使用通用的hook
	const shareItemActions = useShareItemActions({
		onEdit: () => {
			setShowActions(false)
			onEdit?.(item)
		},
		onCancelShare: async () => {
			setShowActions(false)
			onCancelShare?.(item)
		},
		onViewInfo: () => {
			setShowActions(false)
			shareSuccessModal.open(item)
		},
	})

	// 点击Item打开分享信息
	const handleItemClick = useCallback(() => {
		if (item.deleted_at) return
		shareSuccessModal.open(item)
	}, [item, shareSuccessModal])

	const remainingDays = getRemainingDays(item.expire_at)

	return (
		<>
			<div
				className="flex cursor-pointer gap-2 rounded-lg p-2 transition-colors hover:bg-muted"
				onClick={handleItemClick}
			>
				{/* 分享类型图标 */}
				<SuperTooltip title={getShareTypeText(item.share_type, t)}>
					<div
						className={cn(
							"flex h-5 w-5 flex-shrink-0 items-center justify-center rounded",
							badgeStyles.bgClassName,
						)}
					>
						<div className={cn("flex items-center justify-center")}>
							{getShareTypeIcon(item.share_type, {
								public: 20,
								protected: 20,
								team: 20,
							})}
						</div>
					</div>
				</SuperTooltip>

				{/* 内容区域 */}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					{/* 分享名称 - 独占一行 */}
					<MagicEllipseWithTooltip
						text={item.title || t("share.untitled")}
						className="text-sm font-medium leading-none text-foreground"
					/>

					{/* 标签行 */}
					{showProjectBadge && (
						<div className="flex flex-wrap items-center gap-2">
							{/* 分享类型 Badge */}
							<Badge
								variant="secondary"
								className={cn(
									"flex-shrink-0 rounded-full px-2 py-1 text-xs leading-none",
									badgeStyles.bgClassName,
									badgeStyles.textClassName,
								)}
							>
								{getShareTypeText(item.share_type, t)}
							</Badge>

							{/* 项目名 Badge - 只在 showProjectBadge 为 true 时显示 */}

							<ProjectNameBadge
								projectId={item.project_id}
								projectName={item.project_name}
								className="bg-muted leading-none text-muted-foreground"
								clickable={!disableProjectNavigation}
							/>
						</div>
					)}

					{/* 底部行：文件数 + 有效期 */}
					<div className="flex items-center gap-2 text-xs leading-none text-muted-foreground">
						<span className="flex-shrink-0">
							{(item as FileShareItem)?.extend?.file_count || 1}{" "}
							{t("shareManagement.files")}
						</span>
						<div className="h-3 w-px flex-shrink-0 bg-border" />
						{item.expire_at && remainingDays !== null ? (
							<MagicEllipseWithTooltip
								className="flex-shrink-0"
								maxWidth="200px"
								text={
									remainingDays === 0
										? t("shareManagement.expired")
										: t("shareManagement.validUntil", {
											days: remainingDays,
											date: formatExpireAt(item.expire_at),
										})
								}
							>
								{remainingDays === 0
									? t("shareManagement.expired")
									: t("shareManagement.validUntil", {
										days: remainingDays,
										date: formatExpireAt(item.expire_at),
									})}
							</MagicEllipseWithTooltip>
						) : (
							<span>{t("shareManagement.permanentValid")}</span>
						)}
					</div>
				</div>

				{/* 更多按钮 - 如果已删除则不显示 */}
				{!item.deleted_at &&
					(isMobile ? (
						<button
							onClick={(e) => {
								e.stopPropagation()
								setShowActions(true)
							}}
							className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted active:bg-muted/80"
						>
							<IconDots className="h-5 w-5" />
						</button>
					) : (
						<Dropdown
							menu={{
								items: shareItemActions.getDropdownItems(
									shareItem,
								) as MenuProps["items"],
							}}
							trigger={["click"]}
							overlayStyle={{ zIndex: 1300 }}
						>
							<Button
								variant="ghost"
								size="icon"
								className="h-4 w-4 flex-shrink-0"
								onClick={(e) => e.stopPropagation()}
							>
								<IconDots size={16} />
							</Button>
						</Dropdown>
					))}
			</div>

			{/* 移动端操作弹层 */}
			{isMobile && (
				<ActionDrawer
					open={showActions}
					onOpenChange={setShowActions}
					title={t("shareManagement.more")}
					showCancel={false}
				>
					<ActionGroup>
						{shareItemActions
							.getMobileActions(shareItem)
							.slice(0, -1)
							.map((action) => (
								<ActionItem
									key={action.key}
									label={action.label}
									onClick={action.onClick}
								/>
							))}
					</ActionGroup>
					<ActionGroup>
						<ActionItem
							label={t("shareManagement.cancelShare")}
							variant="destructive"
							onClick={() => shareItemActions.handleConfirmCancel(shareItem)}
						/>
					</ActionGroup>
				</ActionDrawer>
			)}

			{/* 分享信息弹窗 */}
			{shareSuccessModal.currentItem && (
				<ShareSuccessModal
					open={shareSuccessModal.visible}
					onClose={shareSuccessModal.close}
					shareName={shareItem.resource_name}
					projectName={shareItem.project_name}
					fileCount={shareItem.extend?.file_count || 1}
					mainFileName={shareItem.main_file_name || t("share.untitled")}
					shareUrl={shareItem.share_url}
					password={shareItem.password}
					expire_at={shareItem.expire_at}
					shareType={shareItem.share_type}
					shareProject={shareItem.share_project}
					fileIds={shareItem.file_ids}
					onEditShare={() => {
						shareSuccessModal.close()
						onEdit?.(item)
					}}
					onCancelShare={async () => {
						shareSuccessModal.close()
						onCancelShare?.(item)
					}}
				/>
			)}
		</>
	)
}

export default memo(MobileProjectFileShareItem)
