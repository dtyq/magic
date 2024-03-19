import { memo, useState, useCallback } from "react"
import { IconDots, IconLock, IconLockOpen } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useResponsive } from "ahooks"
import { Dropdown } from "antd"
import { Button } from "@/opensource/components/shadcn-ui/button"
import ModeTag from "@/opensource/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ModeTag"
import { TopicMode } from "../../../pages/Workspace/types"
import {
	ActionDrawer,
	ActionGroup,
	ActionItem,
} from "@/opensource/components/shadcn-composed/action-drawer"
import type { TopicShareItem } from "../types"
import ProjectNameBadge from "./ProjectNameBadge"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import TopicSharePopover from "../../TopicSharePopover"
import { convertTopicShareItemToShareItem } from "../utils/shareTypeHelpers"
import { useShareItemActions } from "../hooks/useShareItemActions"
import { useTopicSharePopover } from "../hooks/useTopicSharePopover"

interface MobileTopicShareItemProps {
	item: TopicShareItem
	onEdit?: (item: TopicShareItem) => void
	onCancelShare?: (item: TopicShareItem) => void
	disableProjectNavigation?: boolean // 是否禁用项目跳转
	showProjectBadge?: boolean // 是否显示项目名 Badge
}

function MobileTopicShareItem({
	item,
	onEdit,
	onCancelShare,
	disableProjectNavigation = false,
	showProjectBadge = true,
}: MobileTopicShareItemProps) {
	const { t } = useTranslation("super")
	const responsive = useResponsive()
	const isMobile = responsive.md === false
	const [showActions, setShowActions] = useState(false)

	// 使用 TopicSharePopover hook
	const topicSharePopover = useTopicSharePopover()

	// 转换为ShareItem格式
	const shareItem = convertTopicShareItemToShareItem(item, () => t("messageHeader.untitledTopic"))

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
			topicSharePopover.openPopover(item)
		},
	})

	// 点击Item打开话题分享弹层
	const handleItemClick = useCallback(() => {
		if (item.deleted_at) return
		topicSharePopover.openPopover(item)
	}, [item, topicSharePopover])

	return (
		<>
			<div
				className="flex cursor-pointer gap-2 rounded-lg p-2 transition-colors hover:bg-muted"
				onClick={handleItemClick}
			>
				{/* 话题模式图标 */}
				<div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
					<ModeTag mode={item.topic_mode || TopicMode.General} />
				</div>

				{/* 内容区域 */}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					{/* 话题名称 - 独占一行 */}
					<MagicEllipseWithTooltip
						text={item.title || t("messageHeader.untitledTopic")}
						className="text-sm font-medium leading-none text-foreground"
					/>

					{/* 标签行 - 只在 showProjectBadge 为 true 时显示 */}
					{showProjectBadge && (
						<div className="flex flex-wrap items-center gap-2">
							{/* 项目名标签 */}
							<ProjectNameBadge
								projectId={item.project_id}
								projectName={item.project_name}
								className="bg-muted leading-none text-muted-foreground"
								clickable={!disableProjectNavigation}
							/>
						</div>
					)}

					{/* 底部行：查看次数 + 访问密码 */}
					<div className="flex items-center gap-2 text-ellipsis text-nowrap text-xs leading-none text-muted-foreground">
						<span>
							{item.view_count ?? 0} {t("shareManagement.viewTimes")}
						</span>
						<div className="h-3 w-px flex-shrink-0 bg-border" />
						<div className="flex items-center gap-0.5">
							<span>{t("share.accessPassword")}: </span>
							{(item.is_password_enabled ?? item.has_password) ? (
								<IconLock className="h-3 w-3 flex-shrink-0" />
							) : (
								<IconLockOpen className="h-3 w-3 flex-shrink-0" />
							)}
							<span>
								{(item.is_password_enabled ?? item.has_password)
									? t("shareManagement.enabled")
									: t("shareManagement.notEnabled")}
							</span>
						</div>
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
								items: shareItemActions.getDropdownItems(shareItem) as any[],
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
			<TopicSharePopover
				open={topicSharePopover.open}
				onOpenChange={topicSharePopover.setOpen}
				topicId={item.resource_id}
				topicTitle={item.title || t("messageHeader.untitledTopic")}
				onSaveSuccess={() => {
					// 刷新数据或执行其他操作
				}}
			/>
		</>
	)
}

export default memo(MobileTopicShareItem)
