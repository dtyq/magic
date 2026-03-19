import { memo, useCallback, useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { IconPlus, IconX, IconSitemap } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import MagicAvatar from "@/components/base/MagicAvatar"
import MemberDepartmentSelector from "@/components/business/MemberDepartmentSelector"
import { PathNode, TreeNode, NodeType } from "@dtyq/user-selector"
import { SuperMagicApi } from "@/apis"
import type { ShareRangeFieldProps, ShareRange, ShareTarget } from "./types"
import { useMemoizedFn } from "ahooks"

/**
 * 规范化 TreeNode 数据结构，确保字段一致性
 * 关键：统一使用业务 ID（department_id/user_id），而不是记录 ID
 */
function normalizeTreeNode(node: Partial<TreeNode>): TreeNode {
	const isUser = node.type === "User" || node.dataType === NodeType.User

	// 根据类型提取正确的业务 ID
	const businessId = isUser
		? "user_id" in node
			? (node as { user_id?: string }).user_id || node.id
			: node.id // 用户：优先使用 user_id
		: "department_id" in node
			? (node as { department_id?: string }).department_id || node.id
			: node.id // 部门：优先使用 department_id

	// 清理 avatar_url：移除钉钉图片的尺寸后缀（如 @100w_100h）
	// 让 MagicAvatar 的 getAvatarUrl 根据实际需要的尺寸重新添加
	let avatarUrl = (node as { avatar_url?: string }).avatar_url || ""
	if (avatarUrl && avatarUrl.includes("static-legacy.dingtalk.com")) {
		// 移除 @数字w_数字h 格式的后缀，避免重复拼接导致 URL 错误
		avatarUrl = avatarUrl.replace(/@\d+w_\d+h$/, "")
	}

	return {
		// 先展开原始对象，保留所有字段
		...(node as TreeNode),
		// 强制使用业务 ID，确保数据一致性
		id: businessId || "",
		name: node.name || "",
		dataType: node.dataType || (isUser ? NodeType.User : NodeType.Department),
		// 使用清理后的 avatar_url
		avatar_url: avatarUrl,
	}
}

export default memo(function ShareRangeField(props: ShareRangeFieldProps) {
	const { value, onChange, targets, onTargetsChange, resourceId } = props
	const { t } = useTranslation("super")
	const [selectorOpen, setSelectorOpen] = useState(false)

	// MemberDepartmentSelector 的选中状态（临时状态，确认后才更新 targets）
	const [selectedValues, setSelectedValues] = useState<(TreeNode & { path_nodes: PathNode[] })[]>(
		[],
	)

	// 使用 Map 缓存成员详细信息，key 为 id
	const [membersMap, setMembersMap] = useState<Map<string, TreeNode>>(new Map())

	// 根据 targets 派生展示数据（单一数据源原则）
	const displayMembers = useMemo(() => {
		return targets
			.map((t) => membersMap.get(t.target_id))
			.filter((member): member is TreeNode => Boolean(member))
	}, [targets, membersMap])

	/**
	 * 获取初始成员信息（仅在编辑已有分享时调用）
	 */
	const fetchInitialMembers = useMemoizedFn(async () => {
		if (!resourceId || targets.length === 0) {
			return
		}
		try {
			const data = await SuperMagicApi.getShareResourceMembers({
				resource_id: resourceId,
			})
			const allMembers = data?.members || []

			// 更新 membersMap 缓存
			// 关键：使用 department_id/user_id 作为 key，而不是 id
			const newMap = new Map(membersMap)
			allMembers.forEach((member) => {
				const normalized = normalizeTreeNode(member)
				// 根据类型使用正确的 ID 作为 key
				const key =
					member.type === "User"
						? member.user_id || member.id
						: member.department_id || member.id
				if (key) {
					newMap.set(key, normalized)
				}
			})
			setMembersMap(newMap)
		} catch (error) {
			console.error("Failed to fetch share resource members:", error)
		}
	})

	const handleRangeChange = useCallback(
		(range: ShareRange) => {
			onChange(range)
			// 如果切换到"全团队成员"，清空已选成员
			if (range === "all") {
				onTargetsChange([])
			}
		},
		[onChange, onTargetsChange],
	)

	const handleAddMembers = useCallback(() => {
		// 打开选择器时，初始化为已有成员（带上 path_nodes）
		// displayMembers 中的 TreeNode 可能已经包含 path_nodes（从 API 或选择器获取）
		const initialValues: (TreeNode & { path_nodes: PathNode[] })[] = displayMembers.map(
			(member) => {
				// 尝试获取 path_nodes，如果没有则使用空数组
				const pathNodes =
					"path_nodes" in member && Array.isArray(member.path_nodes)
						? (member.path_nodes as PathNode[])
						: []
				return {
					...member,
					path_nodes: pathNodes,
				} as TreeNode & { path_nodes: PathNode[] }
			},
		)
		setSelectedValues(initialValues)
		setSelectorOpen(true)
	}, [displayMembers])

	const handleConfirmSelection = useCallback(
		(selected: (TreeNode & { path_nodes: PathNode[] })[]) => {
			// 更新 membersMap 缓存（保留新选择的成员信息）
			const newMap = new Map(membersMap)
			selected.forEach((item) => {
				const normalized = normalizeTreeNode(item)
				newMap.set(normalized.id, normalized)
			})
			setMembersMap(newMap)

			// 只更新 targets（单一数据源）
			const newTargets: ShareTarget[] = selected.map((item) => {
				const isUser = item.dataType === NodeType.User
				return {
					target_type: isUser ? "User" : "Department",
					target_id: item.id,
				}
			})
			onTargetsChange(newTargets)

			// 关闭选择器
			setSelectorOpen(false)
			setSelectedValues([])
		},
		[membersMap, onTargetsChange],
	)

	const handleCancelSelection = useCallback(() => {
		setSelectorOpen(false)
		setSelectedValues([])
	}, [])

	const handleRemoveTarget = useCallback(
		(targetId: string) => {
			// 只更新 targets，displayMembers 会自动派生
			onTargetsChange(targets.filter((t) => t.target_id !== targetId))
		},
		[targets, onTargetsChange],
	)

	// 只在初始化时获取成员信息（编辑已有分享时回显）
	useEffect(() => {
		// 只在有 resourceId 且 targets 不为空但 membersMap 为空时才请求
		if (resourceId && targets.length > 0 && membersMap.size === 0) {
			fetchInitialMembers()
		}
	}, [resourceId, targets.length, membersMap.size, fetchInitialMembers])

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium leading-none text-foreground">
				{t("share.shareRange")}
			</label>

			{/* Radio Options */}
			<div className="flex gap-2">
				{/* 全团队成员 */}
				<div
					className={cn(
						"flex flex-1 cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-accent",
						value === "all" ? "border-primary" : "border-border",
					)}
					onClick={() => handleRangeChange("all")}
				>
					<div
						className={cn(
							"flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
							value === "all"
								? "border-primary bg-primary"
								: "border-muted-foreground bg-white",
						)}
					>
						{value === "all" && <div className="h-2 w-2 rounded-full bg-white" />}
					</div>
					<span className="text-sm font-medium leading-none">
						{t("share.allTeamMembers")}
					</span>
				</div>

				{/* 指定部门/成员 */}
				<div
					className={cn(
						"flex flex-1 cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-accent",
						value === "designated" ? "border-primary" : "border-border",
					)}
					onClick={() => handleRangeChange("designated")}
				>
					<div
						className={cn(
							"flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
							value === "designated"
								? "border-primary bg-primary"
								: "border-muted-foreground bg-white",
						)}
					>
						{value === "designated" && (
							<div className="h-2 w-2 rounded-full bg-white" />
						)}
					</div>
					<span className="text-sm font-medium leading-none">
						{t("share.designatedMembers")}
					</span>
				</div>
			</div>

			{/* 指定成员选择器 */}
			{value === "designated" && (
				<div className="flex flex-col gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleAddMembers}
						className="w-full justify-center gap-2"
					>
						<MagicIcon component={IconPlus} size={16} />
						{t("share.addMembers")}
					</Button>

					{/* 已选成员列表 */}
					{displayMembers.length > 0 && (
						<div className="flex flex-col gap-1 rounded-md border border-border bg-muted/50 p-2">
							{displayMembers.map((member) => {
								const displayName = member.name || member.id
								const displayAvatar = member.avatar_url
								const isUser = member.dataType === NodeType.User

								return (
									<div
										key={member.id}
										className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-background"
									>
										{isUser ? (
											<MagicAvatar
												src={displayAvatar}
												size={24}
												className="flex-shrink-0"
											>
												{displayName}
											</MagicAvatar>
										) : (
											<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-muted">
												<MagicIcon
													component={IconSitemap}
													size={14}
													className="text-muted-foreground"
												/>
											</div>
										)}
										<span className="flex-1 truncate text-sm">
											{displayName}
										</span>
										<button
											onClick={() => handleRemoveTarget(member.id)}
											className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-destructive/10"
										>
											<MagicIcon
												component={IconX}
												size={14}
												className="text-muted-foreground hover:text-destructive"
											/>
										</button>
									</div>
								)
							})}
						</div>
					)}
				</div>
			)}

			{/* 成员选择器 */}
			<MemberDepartmentSelector
				open={selectorOpen}
				filterAgent
				selectedValues={selectedValues}
				onSelectChange={(values) => {
					// 实时更新选中状态
					setSelectedValues(values as (TreeNode & { path_nodes: PathNode[] })[])
				}}
				title={t("share.addMembers")}
				onOk={(values) =>
					handleConfirmSelection(values as (TreeNode & { path_nodes: PathNode[] })[])
				}
				onCancel={handleCancelSelection}
				zIndex={1500} // 确保在 ShareModal (1400) 之上
				centered
			/>
		</div>
	)
})
