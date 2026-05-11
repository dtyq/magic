import { type ReactNode, useMemo, useState } from "react"
import { Globe, ChevronDown, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import MagicDropdown from "@/components/base/MagicDropdown"
import { Input } from "@/components/shadcn-ui/input"

/**
 * 共享工作区数据项接口
 */
export interface SharedWorkspaceItem {
	id: string
	name: string
	description?: string
	projectCount?: number
}

export interface SharedWorkspaceDropdownProps {
	children: ReactNode
	workspaces: SharedWorkspaceItem[]
	selectedWorkspaceId?: string | null
	onSelect: (workspaceId: string) => void
	loading?: boolean
	placement?: string
	className?: string
	overlayClassName?: string
}

/**
 * 共享工作区下拉选择组件
 * 参考DocumentAddDropdown实现
 * 用于Project类型文档创建时选择共享工作区
 */
function SharedWorkspaceDropdown({
	children,
	workspaces,
	selectedWorkspaceId,
	onSelect,
	loading = false,
	placement = "bottomLeft",
	className,
	overlayClassName,
}: SharedWorkspaceDropdownProps) {
	const { t } = useTranslation("crew/create")
	const [searchValue, setSearchValue] = useState("")

	// 过滤工作区列表
	const filteredWorkspaces = useMemo(() => {
		if (!searchValue) return workspaces
		const lowerSearch = searchValue.toLowerCase()
		return workspaces.filter(
			(workspace) =>
				workspace.name.toLowerCase().includes(lowerSearch) ||
				workspace.description?.toLowerCase().includes(lowerSearch),
		)
	}, [workspaces, searchValue])

	const menuItems = useMemo(
		() => [
			// 搜索框
			{
				key: "search",
				label: (
					<div className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
						<Input
							placeholder={t("documentCreate.common.searchPlaceholder")}
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							className="h-8"
						/>
					</div>
				),
				disabled: true,
			},
			// 分隔线
			{ type: "divider" as const },
			// 工作区列表
			...filteredWorkspaces.map((workspace) => ({
				key: workspace.id,
				icon: <Globe className="mt-0.5 size-4 shrink-0" aria-hidden />,
				label: (
					<div className="flex flex-col gap-0.5">
						<span className="text-sm font-medium">
							{workspace.name || t("documentCreate.project.unnamedWorkspace")}
						</span>
						{workspace.description && (
							<span className="line-clamp-1 text-xs text-muted-foreground">
								{workspace.description}
							</span>
						)}
						{workspace.projectCount !== undefined && (
							<span className="text-xs text-muted-foreground">
								{workspace.projectCount}{" "}
								{t("documentCreate.project.selection.filesInProject", {
									count: workspace.projectCount,
								})}
							</span>
						)}
					</div>
				),
				onClick: () => onSelect(workspace.id),
				className: cn(selectedWorkspaceId === workspace.id && "bg-accent"),
			})),
			// 空状态
			...(filteredWorkspaces.length === 0
				? [
						{
							key: "empty",
							label: (
								<div className="py-2 text-center text-sm text-muted-foreground">
									{searchValue
										? t("documentCreate.common.noSearchResults")
										: t("documentCreate.project.selection.noWorkspaces")}
								</div>
							),
							disabled: true,
						},
					]
				: []),
		],
		[t, filteredWorkspaces, selectedWorkspaceId, searchValue, onSelect],
	)

	return (
		<MagicDropdown
			menu={{ items: menuItems }}
			placement={placement}
			overlayClassName={cn(
				"max-h-[400px] w-[360px] min-w-[360px]",
				"[&_[data-slot='dropdown-menu-item']]:items-start",
				"[&_[data-slot='dropdown-menu-item']]:!p-2",
				overlayClassName,
			)}
			trigger={["click"]}
		>
			<span className={cn("cursor-pointer", className)}>
				{loading ? (
					<div className="flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" />
						<span>{t("documentCreate.common.loading")}</span>
					</div>
				) : (
					children
				)}
			</span>
		</MagicDropdown>
	)
}

export default SharedWorkspaceDropdown
