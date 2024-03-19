/**
 * 消息加载相关状态、组件、行为
 */

import { Form, Flex, Switch } from "antd"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

export default function useMessage() {
	const { t } = useTranslation()
	const MessageLoadSwitch = useMemo(() => {
		return (
			<Flex align="center" justify="space-between" gap={6}>
				<Form.Item name={["model_config", "auto_memory"]} style={{ marginBottom: " 2px" }}>
					<Switch size="small" />
				</Form.Item>
				<span style={{ fontWeight: 400 }}>{t("common.autoMemory", { ns: "flow" })}</span>
			</Flex>
		)
	}, [t])

	return {
		MessageLoadSwitch,
	}
}
