import React from "react"
import { Space } from "antd"
import MagicSwitch from "../../components/MagicSwitch"
import ComponentDemo from "./Container"

const SwitchDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo title="基础开关" description="最基本的开关组件" code="<MagicSwitch />">
				<Space>
					<MagicSwitch />
					<MagicSwitch defaultChecked />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="开关尺寸"
				description="支持不同尺寸的开关"
				code="size: 'default' | 'small'"
			>
				<Space>
					<MagicSwitch size="default" />
					<MagicSwitch size="small" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="开关状态"
				description="支持加载和禁用状态"
				code="loading | disabled"
			>
				<Space>
					<MagicSwitch loading />
					<MagicSwitch size="small" loading />
					<MagicSwitch disabled />
					<MagicSwitch defaultChecked disabled />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="带文字的开关"
				description="可以自定义开关两端的文字"
				code="checkedChildren | unCheckedChildren"
			>
				<Space direction="vertical">
					<MagicSwitch checkedChildren="开" unCheckedChildren="关" />
					<MagicSwitch checkedChildren="ON" unCheckedChildren="OFF" />
					<MagicSwitch checkedChildren="✅" unCheckedChildren="❌" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="受控开关"
				description="通过checked和onChange控制开关状态"
				code="checked | onChange"
			>
				<Space>
					<MagicSwitch
						checked={true}
						onChange={(checked) => console.log("开关状态:", checked)}
					/>
					<MagicSwitch
						checked={false}
						onChange={(checked) => console.log("开关状态:", checked)}
					/>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default SwitchDemo
