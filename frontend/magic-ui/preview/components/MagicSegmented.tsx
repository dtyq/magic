import React, { useState } from "react"
import { Space } from "antd"
import MagicSegmented from "../../components/MagicSegmented"
import ComponentDemo from "./Container"

const SegmentedDemo: React.FC = () => {
	const [value1, setValue1] = useState<string>("选项1")
	const [value2, setValue2] = useState<string>("选项1")

	return (
		<div>
			<ComponentDemo
				title="基础分段控制器"
				description="最基本的分段控制器组件"
				code="<MagicSegmented options={['选项1', '选项2', '选项3']} />"
			>
				<Space>
					<MagicSegmented options={["选项1", "选项2", "选项3"]} />
					<MagicSegmented circle={false} options={["选项1", "选项2", "选项3"]} />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="受控分段控制器"
				description="通过value和onChange控制选中状态"
				code="value | onChange"
			>
				<Space direction="vertical">
					<MagicSegmented
						options={["选项1", "选项2", "选项3"]}
						value={value1}
						onChange={setValue1}
					/>
					<span>当前选中: {value1}</span>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸"
				description="支持不同尺寸的分段控制器"
				code="size: 'large' | 'default' | 'small'"
			>
				<Space direction="vertical">
					<MagicSegmented options={["选项1", "选项2", "选项3"]} size="large" />
					<MagicSegmented options={["选项1", "选项2", "选项3"]} />
					<MagicSegmented options={["选项1", "选项2", "选项3"]} size="small" />
				</Space>
			</ComponentDemo>

			<ComponentDemo title="禁用状态" description="支持禁用某些选项" code="disabled">
				<Space>
					<MagicSegmented
						options={[
							{ label: "选项1", value: "选项1" },
							{ label: "选项2", value: "选项2", disabled: true },
							{ label: "选项3", value: "选项3" },
						]}
					/>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="事件处理"
				description="监听选择变化事件"
				code="onChange: (value) => void"
			>
				<Space direction="vertical">
					<MagicSegmented
						options={["选项1", "选项2", "选项3"]}
						value={value2}
						onChange={(value) => {
							setValue2(value)
							console.log("选择变化:", value)
						}}
					/>
					<span>当前选中: {value2}</span>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default SegmentedDemo
