import { Flex, Form, Popover, Tooltip } from "antd"
import JSONSchemaRenderer from "@/pages/flow/components/JSONSchemaRenderer"
import type React from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"
import defaultAvatar from "@/assets/logos/tool-avatar.png"

type MCPToolsOptionWrapperProps = React.PropsWithChildren<{
	tool: any
}>

export default function MCPToolsOptionWrapper({ tool, children }: MCPToolsOptionWrapperProps) {
	const { t } = useTranslation()
	const { styles } = useStyles()

	const PopContent = useMemo(() => {
		return (
			<Form
				className={styles.popContent}
				layout="vertical"
				onClick={(e) => e.stopPropagation()}
			>
				<Flex align="center" justify="space-between" className={styles.header}>
					<img src={defaultAvatar} alt="" className={styles.avatar} />
					<div className={styles.titleWrap}>
						<Tooltip title={tool?.name}>
							<div className={styles.title}>{tool?.name}</div>
						</Tooltip>
					</div>
				</Flex>
				<span className={styles.toolDesc}>{tool?.description}</span>
				<Form.Item
					label={t("common.inputArguments", { ns: "flow" })}
					style={{ marginTop: "10px" }}
				>
					<JSONSchemaRenderer form={tool?.input_schema} />
				</Form.Item>
				<Form.Item label={t("common.outputArguments", { ns: "flow" })}>
					<JSONSchemaRenderer form={tool?.output_schema} />
				</Form.Item>
			</Form>
		)
	}, [t, tool?.description, tool?.input_schema, tool?.output_schema])

	return (
		<Popover content={PopContent} placement="left">
			{children}
		</Popover>
	)
}
