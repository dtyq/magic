import { Flex, Spin } from "antd"
import LoadingOutlined from "@/opensource/components/icons/LoadingOutlined"
import { useTranslation } from "react-i18next"
import { useVectorKnowledgeEmbedStyles } from "../styles"

export default function LoadingState() {
	const { styles } = useVectorKnowledgeEmbedStyles()
	const { t } = useTranslation("flow")

	return (
		<Flex vertical align="center" justify="center" className={styles.loadingContainer}>
			<Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
			<div className={styles.loadingText}>{t("knowledgeDatabase.loading")}</div>
		</Flex>
	)
}
