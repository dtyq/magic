import { memo, useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { IconDots, IconLock } from "@tabler/icons-react"
import { Dropdown } from "antd"
import { format } from "date-fns"
import ModeTag from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ModeTag"
import { Button } from "@/components/shadcn-ui/button"
import type { TopicShareItem } from "../types"
import ProjectNameBadge from "./ProjectNameBadge"
import TopicSharePopover from "../../TopicSharePopover"
import { cn } from "@/lib/utils"
import { TopicMode } from "../../../pages/Workspace/types"
import { convertTopicShareItemToShareItem } from "../utils/shareTypeHelpers"
import { useShareItemActions } from "../hooks/useShareItemActions"
import { useTopicSharePopover } from "../hooks/useTopicSharePopover"

interface TopicShareListNewProps {
	data: TopicShareItem[]
	loading: boolean
	onCancelShare: (resourceId: string) => void
	onRefresh: () => void
}

function TopicShareListNew({ data, loading, onCancelShare, onRefresh }: TopicShareListNewProps) {
	const { t } = useTranslation("super")
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [selectedItem, setSelectedItem] = useState<TopicShareItem | null>(null)
	const [hoveredId, setHoveredId] = useState<string | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// 使用 TopicSharePopover hook
	const topicSharePopover = useTopicSharePopover()

	// 格式化日期
	const formatDate = useCallback((dateString: string) => {
		try {
			return format(new Date(dateString), "yyyy/MM/dd HH:mm:ss")
		} catch {
			return dateString
		}
	}, [])

	// 使用通用的hook
	const shareItemActions = useShareItemActions({
		onEdit: (shareItem) => {
			const item = data.find((d) => d.resource_id === shareItem.resource_id)
			if (item) {
				setSelectedItem(item)
				setShareModalOpen(true)
			}
		},
		onCancelShare: async (resourceId) => {
			await onCancelShare(resourceId)
		},
		onViewInfo: (shareItem) => {
			const item = data.find((d) => d.resource_id === shareItem.resource_id)
			if (item) {
				topicSharePopover.openPopover(item)
			}
		},
	})

	// 点击item打开话题分享弹层
	const handleItemClick = useCallback(
		(item: TopicShareItem) => {
			topicSharePopover.openPopover(item)
		},
		[topicSharePopover],
	)

	// 关闭分享弹窗
	const handleCloseShareModal = useCallback(() => {
		setShareModalOpen(false)
		setSelectedItem(null)
		onRefresh()
	}, [onRefresh])

	// 加载状态
	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<span className="text-gray-500">{t("common.loading")}</span>
			</div>
		)
	}

	// 空状态
	if (data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-gray-500">{t("shareManagement.noTopicShare")}</p>
			</div>
		)
	}

	return (
		<>
			<div ref={containerRef} className="flex flex-col gap-2">
				{data.map((item) => {
					const isHovered = hoveredId === item.resource_id

					return (
						<div
							key={item.resource_id}
							className={cn(
								"flex h-14 cursor-pointer items-start gap-2 rounded-lg p-2 transition-colors duration-200",
								isHovered && "bg-neutral-100",
							)}
							onMouseEnter={() => setHoveredId(item.resource_id)}
							onMouseLeave={() => setHoveredId(null)}
							onClick={() => handleItemClick(item)}
						>
							{/* 话题模式图标 */}
							<div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
								<ModeTag mode={item.topic_mode || TopicMode.General} />
							</div>

							{/* 内容区域 */}
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								{/* 第一行：话题信息、项目名和操作/分享时间 */}
								<div className="flex h-5 items-center justify-between gap-2">
									<div className="flex min-w-0 flex-1 items-center gap-2">
										{/* 话题名 */}
										<span className="truncate text-sm font-medium leading-none text-gray-900">
											{item.title}
										</span>

										{/* 项目名badge */}
										<ProjectNameBadge
											projectId={item.project_id}
											projectName={item.project_name}
											className="bg-neutral-100 leading-none text-neutral-500"
										/>
									</div>

									{/* 右侧：悬浮显示操作按钮，非悬浮显示分享时间 */}
									<div className="flex h-5 flex-shrink-0 items-center">
										{isHovered && !item.deleted_at ? (
											<Dropdown
												menu={{
													items: shareItemActions.getDropdownItems(
														convertTopicShareItemToShareItem(item, () =>
															t("messageHeader.untitledTopic"),
														),
													),
												}}
												trigger={["click"]}
												overlayStyle={{ zIndex: 1300 }}
												getPopupContainer={() =>
													containerRef.current || document.body
												}
											>
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5"
													onClick={(e) => e.stopPropagation()}
												>
													<IconDots size={16} />
												</Button>
											</Dropdown>
										) : (
											<span className="text-xs leading-none text-neutral-500">
												{t("shareManagement.sharedAt")}:{" "}
												{item.shared_at ? formatDate(item.shared_at) : "-"}
											</span>
										)}
									</div>
								</div>

								{/* 第二行：访问次数和密码状态 */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs leading-none text-neutral-500">
										{/* 访问次数 */}
										<span className="flex-shrink-0">
											{item.view_count ?? 0} {t("shareManagement.views")}
										</span>

										{/* 分隔线 */}
										<svg
											width="1"
											height="12"
											viewBox="0 0 1 12"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<line
												x1="0.5"
												y1="0"
												x2="0.5"
												y2="12"
												stroke="#E5E5E5"
												strokeWidth="1"
											/>
										</svg>

										{/* 密码状态 */}
										<div className="flex items-center gap-0.5">
											<span>{t("share.accessPassword")}:</span>
											<IconLock size={12} className="text-neutral-900" />
											<span
												className={cn(
													item.is_password_enabled
														? "text-neutral-900"
														: "text-neutral-500",
												)}
											>
												{item.is_password_enabled
													? t("shareManagement.enabled")
													: t("shareManagement.notEnabled")}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			{/* 编辑分享弹窗 - 使用新UI TopicSharePopover */}
			{selectedItem && (
				<TopicSharePopover
					open={shareModalOpen}
					onOpenChange={(open) => {
						if (!open) {
							handleCloseShareModal()
						} else {
							setShareModalOpen(true)
						}
					}}
					topicId={selectedItem.resource_id}
					topicTitle={selectedItem.title}
				/>
			)}

			{/* 查看分享信息弹窗 */}
			{topicSharePopover.currentItem && (
				<TopicSharePopover
					open={topicSharePopover.open}
					onOpenChange={(open) => {
						if (!open) {
							topicSharePopover.closePopover()
						}
					}}
					topicId={topicSharePopover.currentItem.resource_id}
					topicTitle={
						topicSharePopover.currentItem.title || t("messageHeader.untitledTopic")
					}
					onSaveSuccess={onRefresh}
				/>
			)}
		</>
	)
}

export default memo(TopicShareListNew)
