import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"
import { Flex, Input, Button, Select, Form } from "antd"
import { useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import { useVectorKnowledgeSettingStyles } from "./styles"
import { KnowledgeApi } from "@/apis"
import ImageUpload from "../../../Upload/ImageUpload"
import SearchSettingsGroup from "../../../Configuration/components/SearchSettingsGroup"
import { RetrieveConfig } from "@/pages/vectorKnowledge/types"
import { useEmbeddingModels } from "../../../Configuration/hooks/useEmbeddingModels"
import type { Knowledge } from "@/types/knowledge"
import { hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import magicToast from "@/components/base/MagicToaster/utils"

interface Props {
	knowledgeBase: Knowledge.Detail
	updateKnowledgeDetail: (code: string) => void
}

export default function Setting({ knowledgeBase, updateKnowledgeDetail }: Props) {
	const { styles } = useVectorKnowledgeSettingStyles()
	const { t } = useTranslation("flow")

	const [iconPreviewUrl, setIconPreviewUrl] = useState("")
	const [iconUploadUrl, setIconUploadUrl] = useState("")

	const [form] = Form.useForm<{
		name: string
		description: string
		embedding_model_id: string
		retrieve_config: RetrieveConfig
	}>()

	// 校验：监听表单name字段，以判断是否可以保存
	const formName = Form.useWatch(["name"], form)

	const { embeddingModelOptions } = useEmbeddingModels()

	/**
	 * 重置
	 */
	const handleReset = useMemoizedFn(async (showMessage = true) => {
		form.setFieldsValue({
			name: knowledgeBase.name,
			description: knowledgeBase.description,
			embedding_model_id: knowledgeBase.embedding_config.model_id,
			retrieve_config: knowledgeBase.retrieve_config,
		})
		if (showMessage) {
			magicToast.success(t("knowledgeDatabase.resetSuccess"))
		}
	})

	/**
	 * 保存
	 */
	const handleSave = useMemoizedFn(async () => {
		try {
			const { name, description, embedding_model_id, retrieve_config } = form.getFieldsValue()
			const res = await KnowledgeApi.updateKnowledge({
				code: knowledgeBase.code,
				name,
				description,
				icon: iconUploadUrl,
				enabled: knowledgeBase.enabled,
				embedding_config: {
					model_id: embedding_model_id,
				},
				retrieve_config,
			})
			if (res) {
				updateKnowledgeDetail(knowledgeBase.code)
				magicToast.success(t("common.savedSuccess"))
			}
		} catch (error) {
			magicToast.error(t("knowledgeDatabase.saveConfigFailed"))
		}
	})

	useEffect(() => {
		handleReset(false)
	}, [knowledgeBase])

	return (
		<Form form={form} layout="vertical">
			<div className={styles.settingTitle}>{t("knowledgeDatabase.setting")}</div>
			<Flex vertical gap={14} className={styles.settingContent}>
				{/* 图标 */}
				<Flex align="center" justify="space-between">
					<div className={cx(styles.required, styles.settingLabel)}>
						{t("knowledgeDatabase.icon")}
					</div>
					{hasEditRight(knowledgeBase.user_operation) && (
						<ImageUpload
							className={styles.settingValue}
							previewIconUrl={iconPreviewUrl}
							setPreviewIconUrl={setIconPreviewUrl}
							setUploadIconUrl={setIconUploadUrl}
						/>
					)}
				</Flex>

				{/* 知识库名称 */}
				<Flex align="flex-start" justify="space-between">
					<div className={cx(styles.required, styles.settingLabel)}>
						{t("knowledgeDatabase.knowledgeName")}
					</div>
					<div className={styles.settingValue}>
						<Form.Item name="name" noStyle>
							<Input
								disabled={!hasEditRight(knowledgeBase.user_operation)}
								placeholder={t("knowledgeDatabase.namePlaceholder")}
							/>
						</Form.Item>
					</div>
				</Flex>

				{/* 描述 */}
				<Flex align="flex-start" justify="space-between">
					<div className={styles.settingLabel}>{t("knowledgeDatabase.description")}</div>
					<div className={styles.settingValue}>
						<Form.Item name="description" noStyle>
							<Input.TextArea
								rows={4}
								disabled={!hasEditRight(knowledgeBase.user_operation)}
								placeholder={t("knowledgeDatabase.descriptionPlaceholder")}
							/>
						</Form.Item>
					</div>
				</Flex>

				{/* Embedding模型 */}
				<Flex align="flex-start" justify="space-between">
					<div className={styles.settingLabel}>
						{t("knowledgeDatabase.embeddingModel")}
					</div>
					<div className={styles.settingValue}>
						<Form.Item name="embedding_model_id" noStyle>
							<Select
								style={{ width: "100%" }}
								options={embeddingModelOptions}
								disabled
							/>
						</Form.Item>
					</div>
				</Flex>

				{/* 检索设置 */}
				<Flex align="flex-start" justify="space-between">
					<div className={styles.settingLabel}>
						{t("knowledgeDatabase.searchSettings")}
					</div>
					<div className={styles.settingValue}>
						{/* 检索设置组 */}
						<SearchSettingsGroup />
					</div>
				</Flex>

				{/* 重置、保存按钮 */}
				{hasEditRight(knowledgeBase.user_operation) && (
					<Flex justify="end" gap={10}>
						<Button className={styles.resetButton} onClick={handleReset}>
							{t("common.reset")}
						</Button>
						<Button
							disabled={!formName}
							type="primary"
							className={styles.saveButton}
							onClick={handleSave}
						>
							{t("common.save")}
						</Button>
					</Flex>
				)}
			</Flex>
		</Form>
	)
}
