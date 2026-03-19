import {
	IconCircleDashedCheck,
	IconDatabaseCog,
	IconDatabasePlus,
	IconMessageCirclePlus,
	IconMessageCircleShare,
	IconSquareRoundedPlus,
	IconTrash,
	IconUpload,
} from "@tabler/icons-react"
import ActionButton from "../ActionButton"
import MagicIcon from "@/components/base/MagicIcon"
import SiderDataSourceItem from "./SiderDataSourceItem"
import SuperMagicDropdown, { useSuperMagicDropdown } from "../SuperMagicDropdown"
import { useState } from "react"
import { DataSourceItemData } from "./types"
import { Tooltip } from "antd"
import useDataSourceDatabaseModal from "../DataSourceDatabase/useDataSourceDatabaseModal"

export default function SiderDataSource() {
	const showDataSourceDatabaseModal = useDataSourceDatabaseModal()

	const [list] = useState<DataSourceItemData[]>([
		{
			id: "1",
			name: "文件数据源",
			type: "file",
		},
		{
			id: "2",
			name: "数据库数据源",
			type: "database",
		},
	])

	// 测试连接
	const onTestConnection = (dataSourceItem: DataSourceItemData) => {
		console.log("onTestConnection", dataSourceItem)
	}

	// 数据库配置
	const onConfigDatabase = (dataSourceItem: DataSourceItemData) => {
		console.log("onConfigDatabase", dataSourceItem)
	}

	// 添加到当前对话
	const onAddToCurrentChat = (dataSourceItem: DataSourceItemData) => {
		console.log("onAddToCurrentChat", dataSourceItem)
	}

	// 添加到新对话
	const onAddToNewChat = (dataSourceItem: DataSourceItemData) => {
		console.log("onAddToNewChat", dataSourceItem)
	}

	// 删除数据源
	const onDelete = (dataSourceItem: DataSourceItemData) => {
		console.log("onDelete", dataSourceItem)
	}

	// 上传文件
	const onUploadFile = () => {
		console.log("onUploadFile")
	}

	// 连接数据库
	const onConnectDatabase = () => {
		console.log("onConnectDatabase")
		showDataSourceDatabaseModal.show()
	}

	const { dropdownContent, delegateProps } = useSuperMagicDropdown<DataSourceItemData>({
		width: 180,
		getMenuItems: (dataSourceItem) => {
			const menuItems = []

			menuItems.push(
				{
					key: "test",
					label: "测试连接",
					icon: <MagicIcon component={IconCircleDashedCheck} stroke={2} size={18} />,
					onClick: () => onTestConnection(dataSourceItem),
				},
				{
					type: "divider" as const,
				},
			)

			if (dataSourceItem.type === "database") {
				menuItems.push(
					{
						key: "config",
						label: "数据库配置",
						icon: <MagicIcon component={IconDatabaseCog} stroke={2} size={18} />,
						onClick: () => onConfigDatabase(dataSourceItem),
					},
					{
						type: "divider" as const,
					},
				)
			}

			menuItems.push(
				{
					key: "add-current-chat",
					label: "添加到当前对话",
					icon: <MagicIcon component={IconMessageCircleShare} stroke={2} size={18} />,
					onClick: () => onAddToCurrentChat(dataSourceItem),
				},
				{
					key: "add-new-chat",
					label: "添加到新对话",
					icon: <MagicIcon component={IconMessageCirclePlus} stroke={2} size={18} />,
					onClick: () => onAddToNewChat(dataSourceItem),
				},
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
					onClick: () => onDelete(dataSourceItem),
				},
			)

			return menuItems
		},
	})

	return (
		<>
			{dropdownContent}
			<div className="flex shrink-0 items-center justify-end border-b border-gray-200 px-1.5 py-2">
				<SuperMagicDropdown
					trigger={["click"]}
					overlayStyle={{
						width: 180,
					}}
					menu={{
						items: [
							{
								key: "file",
								label: "上传文件",
								icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
								onClick: onUploadFile,
							},
							{
								key: "database",
								label: "连接数据库",
								icon: (
									<MagicIcon component={IconDatabasePlus} stroke={2} size={18} />
								),
								onClick: onConnectDatabase,
							},
						],
					}}
				>
					<Tooltip title="添加数据源">
						<ActionButton size={20}>
							<MagicIcon
								className="stroke-gray-400"
								component={IconSquareRoundedPlus}
								stroke={2}
								size={18}
							/>
						</ActionButton>
					</Tooltip>
				</SuperMagicDropdown>
			</div>
			<div className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-1.5">
				{list.length ? (
					list.map((item) => (
						<SiderDataSourceItem key={item.id} data={item} {...delegateProps} />
					))
				) : (
					<div className="flex flex-auto items-center justify-center overflow-hidden text-gray-400">
						<span>暂无数据源</span>
					</div>
				)}
			</div>
		</>
	)
}
