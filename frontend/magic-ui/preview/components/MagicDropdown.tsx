import React from "react"
import { Space } from "antd"
import MagicDropdown from "../../components/MagicDropdown"
import MagicButton from "../../components/MagicButton"
import ComponentDemo from "./Container"

const DropdownDemo: React.FC = () => {
	const menuItems = [
		{ key: "1", label: "菜单项1" },
		{ key: "2", label: "菜单项2" },
		{ key: "3", label: "菜单项3" },
	]

	const nestedMenuItems = [
		{ key: "1", label: "菜单项1" },
		{
			key: "2",
			label: "子菜单",
			children: [
				{ key: "2-1", label: "子菜单项1" },
				{ key: "2-2", label: "子菜单项2" },
			],
		},
		{ key: "3", label: "菜单项3" },
	]

	return (
		<div>
			<ComponentDemo
				title="基础下拉菜单"
				description="最基本的下拉菜单组件"
				code="<MagicDropdown menu={{ items }}><Button>下拉菜单</Button></MagicDropdown>"
			>
				<Space>
					<MagicDropdown
						menu={{
							items: menuItems,
						}}
					>
						<MagicButton>下拉菜单</MagicButton>
					</MagicDropdown>
				</Space>
			</ComponentDemo>

			<ComponentDemo title="嵌套菜单" description="支持嵌套子菜单" code="children">
				<Space>
					<MagicDropdown
						menu={{
							items: nestedMenuItems,
						}}
					>
						<MagicButton>嵌套菜单</MagicButton>
					</MagicDropdown>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同触发方式"
				description="支持不同的触发方式"
				code="trigger: 'click' | 'hover' | 'contextMenu'"
			>
				<Space>
					<MagicDropdown
						trigger={["click"]}
						menu={{
							items: menuItems,
						}}
					>
						<MagicButton>点击触发</MagicButton>
					</MagicDropdown>
					<MagicDropdown
						trigger={["hover"]}
						menu={{
							items: menuItems,
						}}
					>
						<MagicButton>悬停触发</MagicButton>
					</MagicDropdown>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同位置"
				description="支持不同的显示位置"
				code="placement: 'top' | 'bottom' | 'left' | 'right'"
			>
				<Space>
					<MagicDropdown
						placement="top"
						menu={{
							items: menuItems,
						}}
					>
						<MagicButton>顶部显示</MagicButton>
					</MagicDropdown>
					<MagicDropdown
						placement="bottom"
						menu={{
							items: menuItems,
						}}
					>
						<MagicButton>底部显示</MagicButton>
					</MagicDropdown>
				</Space>
			</ComponentDemo>

			<ComponentDemo title="事件处理" description="监听菜单点击事件" code="onClick">
				<Space>
					<MagicDropdown
						menu={{
							items: menuItems,
							onClick: ({ key }) => {
								console.log("点击的菜单项:", key)
							},
						}}
					>
						<MagicButton>事件处理</MagicButton>
					</MagicDropdown>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default DropdownDemo
