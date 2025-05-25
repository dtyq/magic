import { Form, Popover } from "antd"
import JSONSchemaRenderer from "@/opensource/pages/flow/components/JSONSchemaRenderer"
import type React from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"

type ToolsOptionWrapperProps = React.PropsWithChildren<{
	tool: any
}>

export default function ToolsOptionWrapper({ tool, children }: ToolsOptionWrapperProps) {
	const { t } = useTranslation()
	const PopContent = useMemo(() => {
		return (
			<Form className={styles.popContent} layout="vertical">
				<Form.Item label={t("common.toolsDesc", { ns: "flow" })}>
					<span className={styles.toolDesc}>{tool?.description}</span>
				</Form.Item>
				<Form.Item label={t("common.toolsInput", { ns: "flow" })}>
					<JSONSchemaRenderer form={tool?.input?.form?.structure} />
				</Form.Item>
				<Form.Item label={t("common.toolsOutput", { ns: "flow" })}>
					<JSONSchemaRenderer form={tool?.output?.form?.structure} />
				</Form.Item>
			</Form>
		)
	}, [t, tool?.description, tool?.input?.form?.structure, tool?.output?.form?.structure])

	return (
		<Popover content={PopContent} placement="left">
			{children}
		</Popover>
	)
}
