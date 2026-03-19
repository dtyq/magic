import { Button, Checkbox, Flex, Form } from "antd"
import { useTranslation } from "react-i18next"
import { useVectorKnowledgeConfigurationStyles } from "../styles"

interface TextPreprocessRuleProps {
	disabled: boolean
	// 表单字段路径前缀，例如 ['fragment_config', 'normal']
	namePathPrefix: string[]
	allowPreview: boolean
	onReset: () => void
	onPreview: () => void
}

/**
 * 文本预处理规则组件
 */
export default function TextPreprocessRule({
	disabled,
	namePathPrefix,
	allowPreview,
	onReset,
	onPreview,
}: TextPreprocessRuleProps) {
	const { styles } = useVectorKnowledgeConfigurationStyles()
	const { t } = useTranslation("flow")

	return (
		<Flex vertical gap={10}>
			<div className={styles.patternTitle}>
				{t("knowledgeDatabase.segmentPreprocessRules")}
			</div>

			<Form.Item name={[...namePathPrefix, "replace_spaces"]} valuePropName="checked" noStyle>
				<Checkbox disabled={disabled}>
					{t("knowledgeDatabase.segmentPreprocessReplaceRule")}
				</Checkbox>
			</Form.Item>

			<Form.Item name={[...namePathPrefix, "remove_urls"]} valuePropName="checked" noStyle>
				<Checkbox disabled={disabled}>
					{t("knowledgeDatabase.segmentPreprocessDeleteRule")}
				</Checkbox>
			</Form.Item>

			<Flex align="center" gap={10}>
				<Button
					disabled={!allowPreview || disabled}
					color="primary"
					variant="filled"
					onClick={onPreview}
				>
					{t("knowledgeDatabase.segmentPreview")}
				</Button>
				<Button className={styles.resetButton} disabled={disabled} onClick={onReset}>
					{t("common.reset")}
				</Button>
			</Flex>
		</Flex>
	)
}
