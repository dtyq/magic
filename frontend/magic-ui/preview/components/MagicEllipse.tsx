import React from "react"
import { Space } from "antd"
import MagicEllipseWithTooltip from "../../components/MagicEllipseWithTooltip"
import ComponentDemo from "./Container"

const EllipseDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础省略号"
				description="文本超出最大宽度时显示省略号，悬停显示完整内容"
				code="<MagicEllipseWithTooltip text='...' maxWidth='200px' />"
			>
				<Space direction="vertical">
					<MagicEllipseWithTooltip
						text="这是一段很长的文本，会被省略号截断并显示在工具提示中"
						maxWidth="200px"
					/>
					<MagicEllipseWithTooltip text="短文本不会显示省略号" maxWidth="200px" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="自定义最大宽度"
				description="可以通过 maxWidth 属性自定义省略宽度"
				code="maxWidth: string"
			>
				<Space direction="vertical">
					<MagicEllipseWithTooltip text="宽度 100px 的省略效果" maxWidth="100px" />
					<MagicEllipseWithTooltip
						text="宽度 300px 的省略效果，内容更长也不会被截断"
						maxWidth="300px"
					/>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default EllipseDemo
