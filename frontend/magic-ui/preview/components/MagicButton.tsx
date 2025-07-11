import React from "react"
import { Space } from "antd"
import MagicButton from "../../components/MagicButton"
import ComponentDemo from "./Container"

const ButtonDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="按钮类型"
				description="支持多种按钮类型：默认、主要、虚线、链接、文本"
				code="type: 'default' | 'primary' | 'dashed' | 'link' | 'text'"
			>
				<Space wrap>
					<MagicButton>默认按钮</MagicButton>
					<MagicButton type="primary">主要按钮</MagicButton>
					<MagicButton type="dashed">虚线按钮</MagicButton>
					<MagicButton type="link">链接按钮</MagicButton>
					<MagicButton type="text">文本按钮</MagicButton>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="按钮尺寸"
				description="支持三种尺寸：大、默认、小"
				code="size: 'large' | 'default' | 'small'"
			>
				<Space wrap>
					<MagicButton size="large">大按钮</MagicButton>
					<MagicButton>默认按钮</MagicButton>
					<MagicButton size="small">小按钮</MagicButton>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="按钮状态"
				description="支持加载、禁用等状态"
				code="loading | disabled"
			>
				<Space wrap>
					<MagicButton loading>加载中</MagicButton>
					<MagicButton disabled>禁用按钮</MagicButton>
					<MagicButton type="primary" loading>
						主要加载
					</MagicButton>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="按钮对齐"
				description="支持自定义内容对齐方式"
				code="justify: 'flex-start' | 'center' | 'flex-end'"
			>
				<Space direction="vertical" style={{ width: "100%" }}>
					<MagicButton justify="flex-start" style={{ width: 200 }}>
						左对齐按钮
					</MagicButton>
					<MagicButton justify="center" style={{ width: 200 }}>
						居中对齐按钮
					</MagicButton>
					<MagicButton justify="flex-end" style={{ width: 200 }}>
						右对齐按钮
					</MagicButton>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="带图标的按钮"
				description="支持在按钮中添加图标"
				code="icon: ReactNode"
			>
				<Space wrap>
					<MagicButton icon="🔍">搜索</MagicButton>
					<MagicButton type="primary" icon="➕">
						添加
					</MagicButton>
					<MagicButton type="dashed" icon="📁">
						文件夹
					</MagicButton>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="带提示的按钮"
				description="支持添加工具提示"
				code="tip: ReactNode"
			>
				<Space wrap>
					<MagicButton tip="这是一个提示">悬停查看提示</MagicButton>
					<MagicButton type="primary" tip="主要按钮提示">
						主要按钮
					</MagicButton>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default ButtonDemo
