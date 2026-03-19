import { useStyles } from "./styles"
import { Flex, Button } from "antd"
import { IconX } from "@tabler/icons-react"
import { IconMCP } from "@/enhance/tabler/icons-react"
import MagicEditor from "@/components/base/MagicEditor"
import { useMemoizedFn } from "ahooks"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import type { editor } from "monaco-editor"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

interface MCPEditor extends AgentCommonModalChildrenProps {
	value?: string
	onChange?: (value: string) => void
}

const defaultSchema = '{\n    "mcpServers": {}\n}'

export default function MCPEditor(props: MCPEditor) {
	const { onClose, value, onChange } = props
	const { styles } = useStyles()
	const { t } = useTranslation("agent")

	const [marker, setMarker] = useState<Array<editor.IMarker>>([])
	const [rawValue, setRawValue] = useState(props?.value || defaultSchema)

	const onEditorChange = useMemoizedFn((rawValue: string | undefined) => {
		setRawValue?.(rawValue || "")
	})

	const onSubmit = useMemoizedFn(() => {
		// 增加业务层面的MCP规则校验
		try {
			const mcpSchema = JSON.parse(rawValue)
			if (marker.length > 0 && mcpSchema?.mcpServers) {
				magicToast.error(t("mcp.editor.error"))
				return
			}
			onChange?.(rawValue)
			onClose?.()
		} catch (error: any) {
			magicToast.error(t("mcp.editor.formatError"))
		}
	})

	return (
		<div className={styles.layout}>
			<div className={styles.header}>
				<Flex gap={8} align="center">
					<div className={styles.icon}>
						<IconMCP size={30} />
					</div>
					{t("mcp.editor.title")}
				</Flex>
				<div className={styles.close} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>
			<Flex className={styles.body} vertical gap={20}>
				<div className={styles.wrapper}>
					<MagicEditor
						language="json"
						defaultValue={defaultSchema}
						value={value}
						onChange={onEditorChange}
						onValidate={setMarker}
					/>
				</div>
				<Flex className={styles.menu} justify="flex-end" align="center">
					<Flex align="center" gap={10}>
						<Button onClick={onClose}>{t("mcp.editor.cancel")}</Button>
						<Button type="primary" onClick={onSubmit}>
							{t("mcp.editor.confirm")}
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</div>
	)
}
