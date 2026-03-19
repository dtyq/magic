import { IconLoader, IconCircleCheck } from "@tabler/icons-react"
import { Flex, Button, Empty } from "antd"
import { useTranslation } from "react-i18next"
import { getExternalFileIconByType, documentSyncStatusMap } from "../../../constant"
import { useVectorKnowledgeEmbedStyles } from "../styles"
import type { Knowledge } from "@/types/knowledge"
import DEFAULT_KNOWLEDGE_ICON from "@/assets/logos/knowledge-avatar.png"
import KnowledgeConfigSection from "./KnowledgeConfigSection"

interface KnowledgeContentProps {
	createdKnowledge: Knowledge.Detail
	documentList: Knowledge.EmbedDocumentDetail[]
	isEmbed: boolean
	handleViewKnowledge: () => void
	getStatusIcon: (status: documentSyncStatusMap) => React.ReactNode
}

export default function KnowledgeContent({
	createdKnowledge,
	documentList,
	isEmbed,
	handleViewKnowledge,
	getStatusIcon,
}: KnowledgeContentProps) {
	const { styles } = useVectorKnowledgeEmbedStyles()
	const { t } = useTranslation("flow")

	// 准备知识库配置数据
	const knowledgeConfig = {
		fragmentConfig: createdKnowledge.fragment_config,
		embeddingConfig: createdKnowledge.embedding_config,
		retrieveConfig: createdKnowledge.retrieve_config,
	}

	return (
		<>
			<div className={styles.header}>
				<div className={styles.headerTitle}>{t("knowledgeDatabase.createdSuccess")}</div>
				<Flex align="center" justify="space-between">
					<div className={styles.knowledgeInfo}>
						<img
							className={styles.knowledgeIcon}
							src={createdKnowledge.icon || DEFAULT_KNOWLEDGE_ICON}
							alt=""
						/>
						<div className={styles.knowledgeDetail}>
							<div className={styles.knowledgeLabel}>
								{t("knowledgeDatabase.knowledgeName")}
							</div>
							<div className={styles.knowledgeName}>{createdKnowledge.name}</div>
						</div>
					</div>

					<Button type="primary" onClick={handleViewKnowledge}>
						{t("knowledgeDatabase.viewKnowledge")}
					</Button>
				</Flex>
			</div>

			{/* 知识库配置详情区域 */}
			<KnowledgeConfigSection knowledgeConfig={knowledgeConfig} />

			{/* 文件列表 */}
			<div className={styles.fileList}>
				<div className={styles.fileListContent}>
					{documentList.length > 0 ? (
						<>
							<div className={styles.statusSection}>
								{isEmbed ? (
									<div className={styles.statusInfo}>
										<IconCircleCheck color="#32C436" size={24} />
										<div>{t("knowledgeDatabase.vectoringCompleted")}</div>
									</div>
								) : (
									<div className={styles.statusInfo}>
										<IconLoader size={24} />
										<div>{t("knowledgeDatabase.vectoringProcessing")}</div>
									</div>
								)}
							</div>

							<div className={styles.fileListScroll}>
								{documentList.map((file) => (
									<Flex
										key={file.id}
										align="center"
										justify="space-between"
										className={styles.fileItem}
									>
										<div className={styles.fileInfo}>
											{getExternalFileIconByType(file.doc_type)}
											<div>{file.name}</div>
										</div>
										<div>{getStatusIcon(file.sync_status)}</div>
									</Flex>
								))}
							</div>
						</>
					) : (
						<div className={styles.empty}>
							<Empty description={t("knowledgeDatabase.noDocuments")} />
						</div>
					)}
				</div>
			</div>
		</>
	)
}
