import React from "react"
import { Space } from "antd"
import MagicAvatar from "../../components/MagicAvatar"
import ComponentDemo from "./Container"

const AvatarDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础用法"
				description="支持文字头像和图片头像，文字头像会自动生成颜色"
				code="children: string | ReactNode"
			>
				<Space wrap>
					<MagicAvatar>张三</MagicAvatar>
					<MagicAvatar>李四</MagicAvatar>
					<MagicAvatar>王五</MagicAvatar>
					<MagicAvatar>John</MagicAvatar>
					<MagicAvatar>Alice</MagicAvatar>
					<MagicAvatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸"
				description="支持自定义尺寸，默认为 40px"
				code="size: 'small' | 'default' | 'large' | number"
			>
				<Space wrap align="center">
					<MagicAvatar size="small">小</MagicAvatar>
					<MagicAvatar>默认</MagicAvatar>
					<MagicAvatar size="large">大</MagicAvatar>
					<MagicAvatar size={96}>超大</MagicAvatar>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="带徽章的头像"
				description="支持在头像上显示徽章，用于显示状态或通知数量"
				code="badgeProps: BadgeProps"
			>
				<Space wrap>
					<MagicAvatar
						badgeProps={{
							count: 5,
						}}
					>
						张三
					</MagicAvatar>
					<MagicAvatar
						badgeProps={{
							dot: true,
						}}
					>
						李四
					</MagicAvatar>
					<MagicAvatar
						badgeProps={{
							status: "success",
						}}
					>
						王五
					</MagicAvatar>
					<MagicAvatar
						badgeProps={{
							status: "error",
						}}
					>
						赵六
					</MagicAvatar>
					<MagicAvatar
						badgeProps={{
							status: "processing",
						}}
					>
						钱七
					</MagicAvatar>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="自定义样式"
				description="支持自定义背景色、文字颜色等样式"
				code="style: CSSProperties"
			>
				<Space wrap>
					<MagicAvatar style={{ backgroundColor: "#f50", color: "#fff" }}>
						红色
					</MagicAvatar>
					<MagicAvatar style={{ backgroundColor: "#52c41a", color: "#fff" }}>
						绿色
					</MagicAvatar>
					<MagicAvatar style={{ backgroundColor: "#1890ff", color: "#fff" }}>
						蓝色
					</MagicAvatar>
					<MagicAvatar style={{ backgroundColor: "#722ed1", color: "#fff" }}>
						紫色
					</MagicAvatar>
					<MagicAvatar style={{ border: "2px solid #f50" }}>边框</MagicAvatar>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="图片头像"
				description="支持使用图片作为头像，加载失败时会自动回退到文字头像"
				code="src: string"
			>
				<Space wrap>
					<MagicAvatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" />
					<MagicAvatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" />
					<MagicAvatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bob" />
					<MagicAvatar src="invalid-url">回退</MagicAvatar>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="复杂场景"
				description="在实际应用中的使用场景"
				code="badgeProps + size + style"
			>
				<Space direction="vertical" style={{ width: "100%" }}>
					<div>
						<strong>在线用户列表：</strong>
						<Space wrap style={{ marginLeft: 16 }}>
							<MagicAvatar size={32} badgeProps={{ status: "success" }}>
								张三
							</MagicAvatar>
							<MagicAvatar size={32} badgeProps={{ status: "success" }}>
								李四
							</MagicAvatar>
							<MagicAvatar size={32} badgeProps={{ status: "default" }}>
								王五
							</MagicAvatar>
						</Space>
					</div>
					<div style={{ marginTop: 16 }}>
						<strong>消息通知：</strong>
						<Space wrap style={{ marginLeft: 16 }}>
							<MagicAvatar size={40} badgeProps={{ count: 3 }}>
								系统
							</MagicAvatar>
							<MagicAvatar size={40} badgeProps={{ count: 12 }}>
								团队
							</MagicAvatar>
							<MagicAvatar size={40} badgeProps={{ dot: true }}>
								私信
							</MagicAvatar>
						</Space>
					</div>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default AvatarDemo
