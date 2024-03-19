import React from "react"
import { Card, Typography } from "antd"

const { Text } = Typography

export interface ComponentDemoProps {
	title: string
	description?: string
	children: React.ReactNode
	code?: string
}

const ComponentDemo: React.FC<ComponentDemoProps> = ({ title, description, children, code }) => {
	return (
		<Card
			title={title}
			style={{ marginBottom: 24 }}
			extra={
				code && (
					<Text code style={{ fontSize: 12 }}>
						{code}
					</Text>
				)
			}
		>
			{description && (
				<Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
					{description}
				</Text>
			)}
			<div style={{ padding: "16px 0" }}>{children}</div>
		</Card>
	)
}

export default ComponentDemo
