import React from "react"
import { Space } from "antd"
import MagicTag from "../../components/MagicTag"
import ComponentDemo from "./Container"

const TagDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础标签"
				description="最基本的标签组件"
				code="<MagicTag>默认标签</MagicTag>"
			>
				<Space wrap>
					<MagicTag>默认标签</MagicTag>
					<MagicTag color="blue">蓝色标签</MagicTag>
					<MagicTag color="green">绿色标签</MagicTag>
					<MagicTag color="red">红色标签</MagicTag>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="标签颜色"
				description="支持多种预设颜色"
				code="color: 'blue' | 'green' | 'red' | 'orange' | 'purple'"
			>
				<Space wrap>
					<MagicTag color="blue">蓝色</MagicTag>
					<MagicTag color="green">绿色</MagicTag>
					<MagicTag color="red">红色</MagicTag>
					<MagicTag color="orange">橙色</MagicTag>
					<MagicTag color="purple">紫色</MagicTag>
				</Space>
			</ComponentDemo>

			<ComponentDemo title="自定义样式" description="通过style自定义样式" code="style">
				<Space wrap>
					<MagicTag style={{ backgroundColor: "#f0f0f0", color: "#333" }}>
						自定义样式
					</MagicTag>
					<MagicTag
						style={{
							background: "linear-gradient(45deg, #ff6b6b, #4ecdc4)",
							color: "white",
						}}
					>
						渐变背景
					</MagicTag>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default TagDemo
