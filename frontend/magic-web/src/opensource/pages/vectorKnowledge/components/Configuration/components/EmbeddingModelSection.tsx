import { Form, Select } from "antd"
import { useTranslation } from "react-i18next"
import { useVectorKnowledgeConfigurationStyles } from "../styles"

interface EmbeddingModelSectionProps {
	isDocumentConfig: boolean
	embeddingModelOptions: {
		label: string
		title: string
		options: {
			label: React.ReactNode
			title: string
			value: string
		}[]
	}[]
}

/**
 * Embedding模型选择部分组件
 */
export default function EmbeddingModelSection({
	isDocumentConfig,
	embeddingModelOptions,
}: EmbeddingModelSectionProps) {
	const { t } = useTranslation("flow")
	const { styles } = useVectorKnowledgeConfigurationStyles()

	return (
		<div className={styles.configSection}>
			<div className={styles.configTitle}>{t("knowledgeDatabase.embeddingModel")}</div>
			<Form.Item
				name={["embedding_config", "model_id"]}
				rules={[{ required: true, message: t("knowledgeDatabase.selectEmbeddingModel") }]}
			>
				<Select
					disabled={isDocumentConfig}
					placeholder={t("knowledgeDatabase.selectEmbeddingModel")}
					popupClassName={styles.selectPopup}
					showSearch
					optionFilterProp="title"
					options={embeddingModelOptions}
				/>
			</Form.Item>
		</div>
	)
}
