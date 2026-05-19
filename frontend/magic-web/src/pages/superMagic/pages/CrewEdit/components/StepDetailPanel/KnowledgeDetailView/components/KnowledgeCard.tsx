import { memo, useState, useMemo, useCallback } from "react"
import { Ellipsis, FileText, Pencil, Trash2, Play, Pause, RefreshCw } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Progress } from "@/components/shadcn-ui/progress"
import MagicDropdown from "@/components/base/MagicDropdown"
import type { MenuProps } from "antd"
import type { Knowledge } from "@/types/knowledge"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import MagicModal from "@/components/base/MagicModal"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CREW_EDIT_STEP } from "../../../../store"
import { cn } from "@/lib/utils"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { calculateKnowledgeProgress } from "../hooks/useKnowledgeListPolling"

interface KnowledgeCardProps {
	knowledge: Knowledge.KnowledgeItem
	crewCode: string
	onEdit: (knowledge: Knowledge.KnowledgeItem) => void
	onRefresh: () => void
	variant?: "panel" | "sidebar"
	index?: number
}

function KnowledgeCard({
	knowledge,
	crewCode,
	onEdit,
	onRefresh,
	variant = "panel",
	index,
}: KnowledgeCardProps) {
	const { t } = useTranslation("crew/create")
	const [toggling, setToggling] = useState(false)
	const navigate = useNavigate()

	const handleCardClick = useCallback(() => {
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewCode },
			query: {
				panel: CREW_EDIT_STEP.KnowledgeBase,
				code: knowledge.code,
			},
		})
	}, [navigate, crewCode, knowledge.code])

	const handleDelete = useCallback(() => {
		MagicModal.confirm({
			title: t("knowledgeBase.deleteTitle"),
			content: t("knowledgeBase.deleteContent", { name: knowledge.name }),
			variant: "destructive",
			showIcon: true,
			centered: true,
			okText: t("common.delete"),
			onOk: async () => {
				try {
					await KnowledgeApi.deleteKnowledge(knowledge.code)
					magicToast.success(t("knowledgeBase.deleteSuccess"))
					onRefresh()
				} catch {
					magicToast.error(t("knowledgeBase.deleteFailed"))
				}
			},
		})
	}, [t, knowledge.name, knowledge.code, onRefresh])

	const handleEdit = useCallback(() => {
		onEdit(knowledge)
	}, [knowledge, onEdit])

	const handleRebind = useCallback(() => {
		// 导航到重新绑定页面
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewCode },
			query: {
				panel: CREW_EDIT_STEP.KnowledgeBase,
				code: knowledge.code,
				rebind: "true", // 标记为重新绑定模式
			},
		})
	}, [navigate, crewCode, knowledge.code])

	// 判断知识库是否支持重新绑定（仅项目文件和企业知识库类型）
	const supportsRebind = useMemo(() => {
		const sourceType = knowledge.source_type
		return (
			sourceType === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE ||
			sourceType === CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE
		)
	}, [knowledge])

	const handleToggleFromMenu = useCallback(async () => {
		setToggling(true)
		try {
			await KnowledgeApi.updateKnowledge({
				code: knowledge.code,
				name: knowledge.name,
				description: knowledge.description,
				icon: knowledge.icon,
				enabled: !knowledge.enabled,
			})
			onRefresh()
		} catch {
			magicToast.error(t("knowledgeBase.updateFailed"))
		} finally {
			setToggling(false)
		}
	}, [knowledge, t, onRefresh])

	const menuItems = useMemo(() => {
		const items: MenuProps["items"] = [
			{
				key: "edit",
				icon: <Pencil className="size-4" />,
				label: t("knowledgeBase.edit"),
				onClick: handleEdit,
			},
		]

		// 仅对项目文件和企业知识库类型显示"重新选择绑定文件"选项
		if (supportsRebind) {
			items.push({
				key: "rebind",
				icon: <RefreshCw className="size-4" />,
				label: t("knowledgeBase.rebind"),
				onClick: handleRebind,
			})
		}

		items.push(
			{
				key: "toggle",
				icon: knowledge.enabled ? (
					<Pause className="size-4" />
				) : (
					<Play className="size-4" />
				),
				label: knowledge.enabled ? t("knowledgeBase.disable") : t("knowledgeBase.enable"),
				onClick: handleToggleFromMenu,
				disabled: toggling,
			},
			{
				type: "divider" as const,
				key: "divider",
			},
			{
				key: "delete",
				icon: <Trash2 className="size-4" />,
				label: t("knowledgeBase.delete"),
				onClick: handleDelete,
				danger: true,
			},
		)

		return items
	}, [
		t,
		knowledge.enabled,
		toggling,
		handleEdit,
		handleRebind,
		handleToggleFromMenu,
		handleDelete,
		supportsRebind,
	])

	const isSidebar = variant === "sidebar"
	const isDisabled = !knowledge.enabled

	// 计算知识库处理进度
	const progress = useMemo(() => {
		const expectedCount = knowledge.expected_count || 0
		const completedCount = knowledge.completed_count || 0

		if (expectedCount === 0) return null

		const isProcessing = completedCount < expectedCount
		if (!isProcessing) return null

		return {
			percent: calculateKnowledgeProgress({
				expected_count: expectedCount,
				completed_count: completedCount,
			}),
			completed: completedCount,
			total: expectedCount,
		}
	}, [knowledge.expected_count, knowledge.completed_count])

	return (
		<div
			className={cn(
				"group flex cursor-pointer transition-colors",
				isSidebar
					? "items-start gap-2.5 px-2 py-3 hover:bg-muted/50"
					: "items-center gap-2 border-b border-border p-3 hover:bg-muted/50",
				index === 0 && "pt-2",
			)}
			onClick={handleCardClick}
			data-testid={isSidebar ? `crew-knowledge-sidebar-item-${knowledge.code}` : undefined}
		>
			<div
				className={cn(
					"flex shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 ease-out",
					isSidebar ? "size-8" : "h-8 w-8",
					isDisabled
						? "bg-gray-300/25 dark:bg-gray-500/30"
						: "bg-blue-300/25 dark:bg-blue-500/15",
				)}
			>
				{knowledge.icon ? (
					<span className={cn("text-sm", isDisabled && "opacity-60 grayscale")}>
						{knowledge.icon}
					</span>
				) : (
					<FileText
						className={cn(
							"h-4 w-4",
							isDisabled ? "text-muted-foreground" : "text-[#3B82F6]",
						)}
					/>
				)}
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<h4 className="min-w-0 truncate text-sm font-medium text-foreground">
						{knowledge.name}
					</h4>
				</div>
				<MagicEllipseWithTooltip
					className={cn(
						"text-muted-foreground",
						isSidebar
							? "mt-0.5 overflow-hidden text-ellipsis text-nowrap text-xs leading-4"
							: "truncate text-xs",
					)}
					text={knowledge.description || t("knowledgeBase.noDescription")}
					maxWidth="100%"
					placement="rightBottom"
				/>
				{/* 处理进度条 */}
				{progress && (
					<div className="mt-2 flex items-center gap-2">
						<Progress value={progress.percent} className="h-1.5 flex-1" />
						<span className="shrink-0 text-xs text-blue-600 dark:text-blue-400">
							{progress.percent}%
						</span>
					</div>
				)}
			</div>

			<div onClick={(e) => e.stopPropagation()} className="self-center">
				<MagicDropdown menu={{ items: menuItems }} placement="bottomRight">
					<div>
						<Button
							variant="ghost"
							size="icon"
							className={cn(
								"shrink-0 text-foreground transition-colors duration-200 ease-out hover:bg-accent/30 hover:text-foreground",
								"h-8 w-8 rounded-md hover:bg-[#F5F5F5] dark:hover:bg-neutral-800",
							)}
							data-testid={`crew-knowledge-item-more-${knowledge.code}`}
						>
							<Ellipsis className="h-4 w-4" />
							<span className="sr-only">{t("knowledgeBase.actions")}</span>
						</Button>
					</div>
				</MagicDropdown>
			</div>
		</div>
	)
}

export default memo(KnowledgeCard)
