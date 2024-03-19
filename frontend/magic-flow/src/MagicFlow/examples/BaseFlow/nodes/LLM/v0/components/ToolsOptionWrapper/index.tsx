import { BaseDropdownOption } from "@/common/BaseUI/DropdownRenderer/Base"
import JSONSchemaRenderer from "@/common/BaseUI/JSONSchemaRenderer"
import { Form, Popover } from "antd"
import React, { useMemo } from "react"
import styles from "./index.module.less"

type ToolsOptionWrapperProps = React.PropsWithChildren<{
	tool: BaseDropdownOption
}>

export default function ToolsOptionWrapper({ tool, children }: ToolsOptionWrapperProps) {
	const PopContent = useMemo(() => {
		return (
			<Form className={styles.popContent} layout="vertical">
				<Form.Item label="工具描述">
					<span className={styles.toolDesc}>{tool?.description}</span>
				</Form.Item>
				<Form.Item label="工具入参">
					<JSONSchemaRenderer form={tool?.input?.form?.structure} />
				</Form.Item>
				<Form.Item label="工具出参">
					<JSONSchemaRenderer form={tool?.output?.form?.structure} />
				</Form.Item>
			</Form>
		)
	}, [tool])

	return <Popover content={PopContent}>{children}</Popover>
}
