import { memo, useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { IconDots } from "@tabler/icons-react"
import { Dropdown } from "antd"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Badge } from "@/opensource/components/shadcn-ui/badge"
import type { FileShareItem, ProjectShareItem } from "../types"
import ProjectNameBadge from "./ProjectNameBadge"
import { ResourceType, ShareMode, ShareType } from "../../Share/types"
import ShareModal from "../../Share/Modal"
import ShareSuccessModal from "../../Share/FileShareModal/ShareSuccessModal"
import {
	getShareTypeIcon,
	getShareTypeBadgeStyles,
	getShareTypeText,
	generateShareUrl,
	getRemainingDays,
	formatExpireAt,
	convertFileShareItemToShareItem,
} from "../utils/shareTypeHelpers"
import { cn } from "@/opensource/lib/utils"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { useShareItemActions } from "../hooks/useShareItemActions"
import { useShareSuccessModal } from "../hooks/useShareSuccessModal"

// 垂直分隔线组件
function VerticalSeparator() {
	return (
		<svg
			width="1"
			height="12"
			viewBox="0 0 1 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<line x1="0.5" y1="0" x2="0.5" y2="12" stroke="#E5E5E5" strokeWidth="1" />
		</svg>
	)
}

interface FileShareListNewProps {
	data: FileShareItem[]
	loading: boolean
	onCancelShare: (resourceId: string) => void
	onRefresh: () => void
}

function FileShareListNew({ data, loading, onCancelShare, onRefresh }: FileShareListNewProps) {
	const { t } = useTranslation("super")
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [selectedItem, setSelectedItem] = useState<FileShareItem | ProjectShareItem | null>(null)
	const [hoveredId, setHoveredId] = useState<string | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// 使用 ShareSuccessModal hook
	const shareSuccessModal = useShareSuccessModal()

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
				shareSuccessModal.open(item)
			}
		},
	})

	// 点击item打开分享信息
	const handleItemClick = useCallback(
		(item: FileShareItem) => {
			if (item.deleted_at) {
				return
			}
			shareSuccessModal.open(item)
		},
		[shareSuccessModal],
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
				<p className="text-gray-500">{t("shareManagement.noFileShare")}</p>
			</div>
		)
	}

	return (
		<>
			<div ref={containerRef} className="flex flex-col gap-2">
				{data.map((item) => {
					const isHovered = hoveredId === item.resource_id
					const badgeStyles = getShareTypeBadgeStyles(item.share_type)
					const remainingDays = getRemainingDays(item.expire_at)

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
							{/* 分享类型图标 */}
							<div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
								{getShareTypeIcon(item.share_type)}
							</div>

							{/* 内容区域 */}
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								{/* 第一行：文件信息和操作 */}
								<div className="flex h-5 items-center justify-between gap-2">
									<div className="flex min-w-0 flex-1 items-center gap-2">
										{/* 文件名 */}
										<span className="truncate text-sm font-medium leading-5 text-gray-900">
											{item.title}
										</span>

										<div className="flex flex-1 justify-between">
											{/* 项目名badge */}
											<ProjectNameBadge
												projectId={item.project_id}
												projectName={item.project_name}
												className="bg-neutral-100 text-neutral-600"
											/>
											{/* 分享类型badge - 悬浮时隐藏 */}
											{!isHovered && (
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
											)}
										</div>
									</div>

									{/* 操作按钮 - 只在悬浮时显示，且未删除时显示 */}
									{isHovered && !item.deleted_at && (
										<div className="flex flex-shrink-0 items-center gap-1">
											<Dropdown
												menu={{
													items: shareItemActions.getDropdownItems(
														convertFileShareItemToShareItem(item, () =>
															t("share.untitled"),
														),
													) as any[],
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
													className="h-7 w-7"
													onClick={(e) => e.stopPropagation()}
												>
													<IconDots size={16} />
												</Button>
											</Dropdown>
										</div>
									)}
								</div>

								{/* 第二行：统计信息 */}
								<div className="flex items-center gap-2 text-xs text-gray-500">
									<span className="flex-shrink-0">
										{(item.extend?.file_count || 0) > 1
											? t("shareManagement.multipleFiles", {
													count: item.extend?.file_count,
												})
											: t("shareManagement.oneFile")}
									</span>
									<VerticalSeparator />
									<span className="flex-shrink-0">
										{item.view_count ?? 0} {t("shareManagement.views")}
									</span>
									<VerticalSeparator />
									<MagicEllipseWithTooltip
										className="flex-shrink-0"
										maxWidth="200px"
										text={
											item.expire_at && remainingDays !== null
												? remainingDays === 0
													? t("shareManagement.expired")
													: t("shareManagement.validUntil", {
															days: remainingDays,
															date: formatExpireAt(item.expire_at),
														})
												: t("shareManagement.permanentValid")
										}
									></MagicEllipseWithTooltip>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			{/* 编辑分享弹窗 */}
			{selectedItem && (
				<ShareModal
					open={shareModalOpen}
					onCancel={handleCloseShareModal}
					shareMode={ShareMode.File}
					resourceId={selectedItem.resource_id}
					projectId={selectedItem.project_id}
					types={[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]}
				/>
			)}

			{/* 分享信息弹窗 */}
			{shareSuccessModal.currentItem && (
				<ShareSuccessModal
					open={shareSuccessModal.visible}
					onClose={shareSuccessModal.close}
					shareName={shareSuccessModal.currentItem.title || t("share.untitled")}
					projectName={shareSuccessModal.currentItem.project_name}
					shareUrl={generateShareUrl(
						shareSuccessModal.currentItem.resource_id,
						shareSuccessModal.currentItem.password,
						"files",
					)}
					password={shareSuccessModal.currentItem.password}
					expire_at={shareSuccessModal.currentItem.expire_at}
					shareType={shareSuccessModal.currentItem.share_type}
					shareProject={
						"share_project" in shareSuccessModal.currentItem
							? shareSuccessModal.currentItem.share_project
							: false
					}
					fileCount={shareSuccessModal.currentItem.extend?.file_count || 1}
					mainFileName={
						shareSuccessModal.currentItem.main_file_name || t("share.untitled")
					}
					fileIds={(shareSuccessModal.currentItem as any).file_ids}
					onEditShare={() => {
						const item = shareSuccessModal.currentItem
						shareSuccessModal.close()
						if (item) {
							setSelectedItem(item)
							setShareModalOpen(true)
						}
					}}
					onCancelShare={async () => {
						const item = shareSuccessModal.currentItem
						shareSuccessModal.close()
						if (item) {
							await onCancelShare(item.resource_id)
						}
					}}
				/>
			)}
		</>
	)
}

export default memo(FileShareListNew)
