import React from "react"
import MagicMenu from "../../components/MagicMenu"
import ComponentDemo from "./Container"

const MenuDemo: React.FC = () => {
	const horizontalItems = [
		{ key: "1", label: "菜单项1" },
		{ key: "2", label: "菜单项2" },
		{ key: "3", label: "菜单项3" },
	]

	const verticalItems = [
		{ key: "1", label: "菜单项1" },
		{ key: "2", label: "菜单项2" },
		{ key: "3", label: "菜单项3" },
	]

	const nestedItems = [
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
			<ComponentDemo title="水平菜单" description="水平方向的菜单" code="mode='horizontal'">
				<MagicMenu
					mode="horizontal"
					items={horizontalItems}
					style={{ borderBottom: "1px solid #f0f0f0" }}
				/>
			</ComponentDemo>

			<ComponentDemo title="垂直菜单" description="垂直方向的菜单" code="mode='vertical'">
				<div style={{ width: 200, border: "1px solid #f0f0f0" }}>
					<MagicMenu mode="vertical" items={verticalItems} />
				</div>
			</ComponentDemo>

			<ComponentDemo title="嵌套菜单" description="支持嵌套子菜单" code="children">
				<div style={{ width: 200, border: "1px solid #f0f0f0" }}>
					<MagicMenu mode="vertical" items={nestedItems} />
				</div>
			</ComponentDemo>

			<ComponentDemo title="事件处理" description="监听菜单点击事件" code="onClick">
				<MagicMenu
					mode="horizontal"
					items={horizontalItems}
					onClick={({ key }) => {
						console.log("点击的菜单项:", key)
					}}
					style={{ borderBottom: "1px solid #f0f0f0" }}
				/>
			</ComponentDemo>

			<ComponentDemo
				title="默认选中"
				description="设置默认选中的菜单项"
				code="defaultSelectedKeys"
			>
				<MagicMenu
					mode="horizontal"
					items={horizontalItems}
					defaultSelectedKeys={["1"]}
					style={{ borderBottom: "1px solid #f0f0f0" }}
				/>
			</ComponentDemo>
		</div>
	)
}

export default MenuDemo
