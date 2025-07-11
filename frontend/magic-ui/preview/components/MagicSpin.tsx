import React from "react"
import { Space, Card } from "antd"
import MagicSpin from "../../components/MagicSpin"
import ComponentDemo from "./Container"

const SpinDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo title="基础加载" description="最基本的加载组件" code="<MagicSpin />">
				<Space size={100}>
					<MagicSpin />
					<MagicSpin size="large" />
					<MagicSpin size="small" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="包裹内容的加载"
				description="将加载状态包裹在内容周围"
				code="<MagicSpin><div>内容</div></MagicSpin>"
			>
				<MagicSpin tip="加载中...">
					<Card title="内容卡片" style={{ width: 300 }}>
						<p>这是被加载组件包裹的内容</p>
						<p>当loading为true时会显示加载动画</p>
					</Card>
				</MagicSpin>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸"
				description="支持不同尺寸的加载动画"
				code="size: 'small' | 'default' | 'large'"
			>
				<Space size={100}>
					<MagicSpin size="small" tip="小尺寸" />
					<MagicSpin tip="默认尺寸" />
					<MagicSpin size="large" tip="大尺寸" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="延迟显示"
				description="延迟显示加载动画，避免闪烁"
				code="delay: 500"
			>
				<Space size={100}>
					<MagicSpin delay={500} tip="延迟500ms显示" />
					<MagicSpin delay={1000} tip="延迟1秒显示" />
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default SpinDemo
