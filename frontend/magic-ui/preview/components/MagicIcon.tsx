import React from "react"
import { Space } from "antd"
import MagicIcon from "../../components/MagicIcon"
import ComponentDemo from "./Container"
import { IconSearch, IconFolder, IconSettings, IconUser, IconHome } from "@tabler/icons-react"

const IconDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础图标"
				description="最基本的图标组件"
				code="<MagicIcon name='IconHome' />"
			>
				<Space>
					<MagicIcon component={IconHome} />
					<MagicIcon component={IconUser} />
					<MagicIcon component={IconSettings} />
					<MagicIcon component={IconSearch} />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸"
				description="支持不同尺寸的图标"
				code="size: number | string"
			>
				<Space>
					<MagicIcon component={IconHome} size={16} />
					<MagicIcon component={IconHome} size={24} />
					<MagicIcon component={IconHome} size={32} />
					<MagicIcon component={IconHome} size={48} />
				</Space>
			</ComponentDemo>

			<ComponentDemo title="不同颜色" description="支持不同颜色的图标" code="color: string">
				<Space>
					<MagicIcon component={IconHome} color="#1890ff" />
					<MagicIcon component={IconHome} color="#52c41a" />
					<MagicIcon component={IconHome} color="#faad14" />
					<MagicIcon component={IconHome} color="#f5222d" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="描边宽度"
				description="自定义图标的描边宽度"
				code="stroke: number"
			>
				<Space>
					<MagicIcon component={IconHome} stroke={1} />
					<MagicIcon component={IconHome} stroke={2} />
					<MagicIcon component={IconHome} stroke={3} />
				</Space>
			</ComponentDemo>

			<ComponentDemo title="自定义组件" description="使用自定义的图标组件" code="component">
				<Space>
					<MagicIcon component={IconSearch} />
					<MagicIcon component={IconFolder} />
					<MagicIcon component={IconSettings} />
					<MagicIcon component={IconUser} />
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default IconDemo
