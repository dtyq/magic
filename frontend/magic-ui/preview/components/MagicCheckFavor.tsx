import React, { useState } from "react"
import { Space } from "antd"
import MagicCheckFavor from "../../components/MagicCheckFavor"
import ComponentDemo from "./Container"

const CheckFavorDemo: React.FC = () => {
	const [checked1, setChecked1] = useState(false)
	const [checked2, setChecked2] = useState(true)

	return (
		<div>
			<ComponentDemo
				title="基础收藏"
				description="最基本的收藏组件"
				code="<MagicCheckFavor />"
			>
				<Space>
					<MagicCheckFavor />
					<MagicCheckFavor defaultChecked />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="受控收藏"
				description="通过checked和onChange控制收藏状态"
				code="checked | onChange"
			>
				<Space>
					<MagicCheckFavor
						checked={checked1}
						onChange={(checked) => setChecked1(checked as boolean)}
					/>
					<span>状态: {checked1 ? "已收藏" : "未收藏"}</span>
				</Space>
			</ComponentDemo>

			<ComponentDemo title="默认状态" description="设置默认的收藏状态" code="defaultChecked">
				<Space>
					<MagicCheckFavor defaultChecked={false} />
					<MagicCheckFavor defaultChecked={true} />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="事件处理"
				description="监听收藏状态变化"
				code="onChange: (checked: boolean) => void"
			>
				<Space direction="vertical">
					<MagicCheckFavor
						checked={checked2}
						onChange={(checked) => {
							setChecked2(checked as boolean)
							console.log("收藏状态变化:", checked)
						}}
					/>
					<span>当前状态: {checked2 ? "已收藏" : "未收藏"}</span>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="自定义样式"
				description="通过className和style自定义样式"
				code="className | style"
			>
				<Space>
					<MagicCheckFavor className="custom-favor" style={{ transform: "scale(1.5)" }} />
					<MagicCheckFavor
						defaultChecked
						style={{
							transform: "scale(1.2)",
							filter: "hue-rotate(90deg)",
						}}
					/>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default CheckFavorDemo
