import { Input, MenuProps, Tooltip } from "antd"
import {
	IconEdit,
	IconFolderDown,
	IconFolderPlus,
	IconMessageCircleShare,
	IconMessageCirclePlus,
	IconDownload,
	IconShare,
	IconStar,
	IconTrash,
	IconUpload,
	IconCloudShare,
} from "@tabler/icons-react"
import ActionButton from "../ActionButton"
import SiderDashboardItem, { SiderDashboardItemRef } from "./SiderDashboardItem"
import MagicIcon from "@/components/base/MagicIcon"
import { useSuperMagicDropdown } from "../SuperMagicDropdown"
import { useMemo, useState, useCallback, useRef } from "react"
import { DashboardItemData } from "./types"
import useData from "./useData"
import { IconOpenWindow } from "@/enhance/tabler/icons-react"
import FileTree from "./FileTree"

export default function SiderDashboard() {
	const { list, setList, expandedKeys, setExpandedKeys, checkedList, setCheckedList } = useData()

	const [searchValue, setSearchValue] = useState("")

	// SiderDashboardItem 的 refs 管理
	const itemRefs = useRef<Record<string, SiderDashboardItemRef>>({})

	// 将 checkedList 转换为 checkedKeys
	const checkedKeys = useMemo(() => {
		return checkedList.map((item) => item.id)
	}, [checkedList])

	// 处理复选框选中变化
	const handleCheck = useCallback(
		(checkedKeys: string[], checkedNodes: DashboardItemData[]) => {
			setCheckedList(checkedNodes)
		},
		[setCheckedList],
	)

	// 处理展开收起变化
	const handleExpand = useCallback(
		(expandedKeys: string[]) => {
			setExpandedKeys(expandedKeys)
		},
		[setExpandedKeys],
	)

	// 更新收藏状态的辅助函数
	const updateFavoriteStatus = (
		items: DashboardItemData[],
		targetId: string,
		isFavorite: boolean,
	): DashboardItemData[] => {
		return items.map((item) => {
			if (item.id === targetId) {
				return { ...item, isFavorite }
			}
			if (item.children) {
				return {
					...item,
					children: updateFavoriteStatus(item.children, targetId, isFavorite),
				}
			}
			return item
		})
	}

	// 处理重命名回调 - SiderDashboardItem 需要的格式
	const handleRename = useCallback(
		(item: DashboardItemData, newName: string) => {
			console.log(`重命名项目 ${item.id} 为: ${newName}`)

			const updateItemName = (
				items: DashboardItemData[],
				targetId: string,
				newName: string,
			): DashboardItemData[] => {
				return items.map((item) => {
					if (item.id === targetId) {
						return { ...item, name: newName }
					}
					if (item.children) {
						return {
							...item,
							children: updateItemName(item.children, targetId, newName),
						}
					}
					return item
				})
			}

			setList((prevList) => updateItemName(prevList, item.id, newName))
		},
		[setList],
	)

	// 打开看板
	const onOpenDashboard = (dashboardItem: DashboardItemData) => {
		console.log("onOpenDashboard", dashboardItem)
	}

	// 打开文件
	const onOpenFile = (dashboardItem: DashboardItemData) => {
		console.log("onOpenFile", dashboardItem)
	}

	// 替换文件
	const onReplaceFile = (dashboardItem: DashboardItemData) => {
		console.log("onReplaceFile", dashboardItem)
	}

	// 重命名
	const onRename = (dashboardItem: DashboardItemData) => {
		console.log("onRename", dashboardItem)
		// 触发对应 SiderDashboardItem 的重命名功能
		const itemRef = itemRefs.current[dashboardItem.id]
		if (itemRef) {
			itemRef.rename()
		}
	}

	// 添加到当前会话
	const onAddToCurrentChat = (dashboardItem: DashboardItemData) => {
		console.log("onAddToCurrentChat", dashboardItem)
	}

	// 添加到新会话
	const onAddToNewChat = (dashboardItem: DashboardItemData) => {
		console.log("onAddToNewChat", dashboardItem)
	}

	// 下载原始文件
	const onDownloadOriginal = (dashboardItem: DashboardItemData) => {
		console.log("onDownloadOriginal", dashboardItem)
	}

	// 下载 PDF 格式
	const onDownloadPdf = (dashboardItem: DashboardItemData) => {
		console.log("onDownloadPdf", dashboardItem)
	}

	// 分享看板
	const onShareDashboard = (dashboardItem: DashboardItemData) => {
		console.log("onShareDashboard", dashboardItem)
	}

	// 复制至云盘
	const onCopyToCloud = (dashboardItem: DashboardItemData) => {
		console.log("onCopyToCloud", dashboardItem)
	}

	// 添加收藏
	const onAddToFavorite = (dashboardItem: DashboardItemData) => {
		console.log("onAddToFavorite", dashboardItem)
		setList((prevList) => updateFavoriteStatus(prevList, dashboardItem.id, true))
	}

	// 从收藏中移除
	const onRemoveFromFavorite = (dashboardItem: DashboardItemData) => {
		console.log("onRemoveFromFavorite", dashboardItem)
		setList((prevList) => updateFavoriteStatus(prevList, dashboardItem.id, false))
	}

	// 删除
	const onDelete = (dashboardItem: DashboardItemData) => {
		console.log("onDelete", dashboardItem)
	}

	// 添加目录
	const onAddFolder = () => {
		console.log("onAddFolder")
	}

	// 下载文件 - 现在可以处理选中的文件
	const onDownload = () => {
		console.log("onDownload", "选中的文件:", checkedList)
		if (checkedList.length === 0) {
			console.log("没有选中任何文件")
			return
		}
		// 这里可以实现批量下载逻辑
		checkedList.forEach((item) => {
			console.log(`下载文件: ${item.name} (${item.type})`)
		})
	}

	// 点击看板
	const onDashboardClick = (dashboardItem: DashboardItemData) => {
		console.log("onDashboardClick", dashboardItem)
	}

	const { dropdownContent, delegateProps } = useSuperMagicDropdown<DashboardItemData>({
		width: 180,
		getMenuItems: (dashboardItem) => {
			const items: MenuProps["items"] = []

			if (dashboardItem.type === "dashboard") {
				items.push(
					{
						label: "打开看板",
						key: "openDashboard",
						icon: <MagicIcon component={IconOpenWindow} stroke={2} size={18} />,
						onClick: () => onOpenDashboard(dashboardItem),
					},
					{
						type: "divider" as const,
					},
					{
						label: "替换文件",
						key: "replaceFile",
						icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
						onClick: () => onReplaceFile(dashboardItem),
					},
				)
			} else if (dashboardItem.type === "folder") {
				items.push(
					{
						label: "打开文件",
						key: "openFile",
						icon: <MagicIcon component={IconOpenWindow} stroke={2} size={18} />,
						onClick: () => onOpenFile(dashboardItem),
					},
					{
						type: "divider" as const,
					},
				)
			}

			items.push(
				{
					label: "重命名",
					key: "rename",
					icon: <MagicIcon component={IconEdit} stroke={2} size={18} />,
					onClick: () => onRename(dashboardItem),
				},
				{
					type: "divider" as const,
				},
				{
					label: "添加到当前会话",
					key: "addToCurrentChat",
					icon: <MagicIcon component={IconMessageCircleShare} stroke={2} size={18} />,
					onClick: () => onAddToCurrentChat(dashboardItem),
				},
				{
					label: "添加到新会话",
					key: "addToNewChat",
					icon: <MagicIcon component={IconMessageCirclePlus} stroke={2} size={18} />,
					onClick: () => onAddToNewChat(dashboardItem),
				},
				{
					type: "divider" as const,
				},
			)

			if (dashboardItem.type === "dashboard") {
				items.push(
					{
						label: "下载文件",
						key: "download",
						icon: <MagicIcon component={IconDownload} stroke={2} size={18} />,
						children: [
							{
								label: "下载原始文件",
								key: "downloadOriginal",
								onClick: () => onDownloadOriginal(dashboardItem),
							},
							{
								label: "下载 PDF 格式",
								key: "downloadPdf",
								onClick: () => onDownloadPdf(dashboardItem),
							},
						],
					},
					{
						label: "分享看板",
						key: "shareDashboard",
						icon: <MagicIcon component={IconShare} stroke={2} size={18} />,
						onClick: () => onShareDashboard(dashboardItem),
					},
				)
			}

			items.push({
				label: "复制至云盘",
				key: "copyToCloud",
				icon: <MagicIcon component={IconCloudShare} stroke={2} size={18} />,
				onClick: () => onCopyToCloud(dashboardItem),
			})

			// 根据收藏状态显示对应的菜单项
			if (dashboardItem.isFavorite) {
				items.push({
					label: "从收藏中移除",
					key: "removeFromFavorite",
					icon: <MagicIcon component={IconStar} stroke={2} size={18} />,
					onClick: () => onRemoveFromFavorite(dashboardItem),
				})
			} else {
				items.push({
					label: "添加收藏",
					key: "addToFavorite",
					icon: <MagicIcon component={IconStar} stroke={2} size={18} />,
					onClick: () => onAddToFavorite(dashboardItem),
				})
			}

			items.push(
				{
					type: "divider" as const,
				},
				{
					key: "delete",
					danger: true,
					label: "删除",
					icon: (
						<MagicIcon
							component={IconTrash}
							stroke={2}
							size={18}
							className="stroke-red-500"
						/>
					),
					onClick: () => onDelete(dashboardItem),
				},
			)

			return items
		},
	})

	return (
		<>
			{dropdownContent}
			<div className="flex shrink-0 items-center justify-end border-b border-gray-200 px-1.5 py-2">
				<div className="flex items-center gap-2">
					<Tooltip title="添加目录">
						<ActionButton size={20} className="rounded" onClick={onAddFolder}>
							<MagicIcon
								className="stroke-gray-400"
								component={IconFolderPlus}
								stroke={2}
								size={18}
							/>
						</ActionButton>
					</Tooltip>
					<Tooltip title="下载文件">
						<ActionButton size={20} className="rounded" onClick={onDownload}>
							<MagicIcon
								className="stroke-gray-400"
								component={IconFolderDown}
								stroke={2}
								size={18}
							/>
						</ActionButton>
					</Tooltip>
				</div>
			</div>
			<div className="flex flex-1 flex-col">
				<div className="flex-none px-1.5 pb-1">
					<Input
						placeholder="搜索看板"
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
					/>
				</div>
				<div className="flex-auto overflow-y-auto overflow-x-hidden px-1.5 pb-1.5">
					<div className="flex flex-col gap-1">
						<FileTree<DashboardItemData>
							data={list}
							checkable
							checkedKeys={checkedKeys}
							onCheck={handleCheck}
							expandedKeys={expandedKeys}
							onExpand={handleExpand}
							searchValue={searchValue}
							filterTreeNode={(node, searchValue) =>
								node.name.toLowerCase().includes(searchValue.toLowerCase())
							}
							itemRender={(
								node,
								{ level, expanded, onExpand, checked, indeterminate, onCheck },
							) => {
								// 使用 SiderDashboardItem 渲染，保持原有的完整功能
								return (
									<SiderDashboardItem
										ref={(instance) => {
											if (instance) {
												itemRefs.current[node.id] = instance
											} else {
												delete itemRefs.current[node.id]
											}
										}}
										data={node}
										deep={level}
										isChecked={checked}
										isIndeterminate={indeterminate}
										onCheckChange={(item, checked) => {
											// 使用 FileTree 的 onCheck 方法，它会处理父子联动
											onCheck(checked)
										}}
										onRename={handleRename}
										isExpanded={expanded}
										onExpand={onExpand}
										onDashboardClick={onDashboardClick}
										{...delegateProps}
									/>
								)
							}}
							emptyText="暂无数据看板"
						/>
					</div>
				</div>
			</div>
		</>
	)
}
