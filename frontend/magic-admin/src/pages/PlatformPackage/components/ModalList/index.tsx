import { Empty, Flex, message } from "antd"
import { memo, useEffect, useRef, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	IconPlus,
	IconCircleCheckFilled,
	IconEdit,
	IconTrash,
	IconCircleXFilled,
	IconCopy,
} from "@tabler/icons-react"
import { useMemoizedFn, useRequest } from "ahooks"
import {
	MagicButton,
	MagicSwitch,
	SubHeader,
	WarningModal,
	DangerLevel,
	MagicModal,
} from "components"
import { groupBy } from "lodash-es"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useApis } from "@/apis"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useAdminStore } from "@/stores/admin"
import { useStyles } from "./styles"
import { AddModelModal } from "./components/AddModelModal"
import { FailDetailModal } from "./components/FailDetailModal"
import BaseModelItem from "./components/BaseModelItem"

interface ModelGroup {
	key: AiModel.ModelTypeGroup
	title: string
	list: AiManage.ModelInfo[]
}

interface ModalListProps {
	data: AiManage.ServiceProviderDetail | null
	hasEditRight: boolean
	setData: React.Dispatch<React.SetStateAction<AiManage.ServiceProviderDetail | null>>
}

const ModalList = ({ data, hasEditRight, setData }: ModalListProps) => {
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const { t } = useTranslation("admin/ai/model")
	const { t: tCommon } = useTranslation("admin/common")
	const openModal = useOpenModal()

	const { AIManageApi } = useApis()
	const { isOfficialOrg } = useAdminStore()

	const [models, setModels] = useState<AiManage.ModelInfo[]>([])
	const [currentModel, setCurrentModel] = useState<AiManage.ModelInfo | null>(null)
	const [loading, setLoading] = useState<boolean>(false)

	const { run: trigger, loading: isMutating } = useRequest(
		(params: AiManage.UpdateModelStatusParams) =>
			isOfficialOrg
				? AIManageApi.updateModelStatus(params)
				: AIManageApi.updateModelStatusNonOfficial(params),
		{ manual: true },
	)

	/* 是否为官方服务商 */
	const isOfficial = data?.provider_type === AiModel.ProviderType.Official
	/* 大语言模型 */
	const isLLM = data?.category === AiModel.ServiceProviderCategory.LLM

	const modelConnectionResultMap = useRef<Map<string, AiManage.TestConnectionResult>>(new Map())

	useEffect(() => {
		if (data) {
			setModels(data.models)
		}
	}, [data])

	/* 模型类型组映射 */
	const ModelTypeGroupMap: Record<AiModel.ModelTypeGroup, string> = useMemo(
		() => ({
			[AiModel.ModelTypeGroup.TextToImage]: t("textToImage"),
			[AiModel.ModelTypeGroup.ImageToImage]: t("imageToImage"),
			[AiModel.ModelTypeGroup.ImageEnhance]: t("imageEnhance"),
			[AiModel.ModelTypeGroup.LargeLanguageModel]: t("languageModel"),
			[AiModel.ModelTypeGroup.Embedding]: t("embeddingModel"),
		}),
		[t],
	)

	const modelGroup: ModelGroup[] = useMemo(() => {
		if (isLLM && isOfficial) {
			return [
				{
					key: AiModel.ModelTypeGroup.LargeLanguageModel,
					title: t("modelList"),
					list: models,
				},
			]
		}

		const groupedModels = groupBy(models, "model_type")
		const formattedModels = Object.entries(ModelTypeGroupMap)
			.map(([key, value]) => ({
				key: Number(key),
				title: value,
				list: groupedModels[key] || [],
			}))
			.filter((item) => item.list.length > 0)

		if (formattedModels.length > 0) {
			return formattedModels
		}
		return [
			{
				key: isLLM
					? AiModel.ModelTypeGroup.LargeLanguageModel
					: AiModel.ModelTypeGroup.TextToImage,
				title: t("modelList"),
				list: models,
			},
		]
	}, [isLLM, isOfficial, models, ModelTypeGroupMap, t])

	/* 更新模型状态 */
	const updateModelStatus = async (id: string, checked: boolean) => {
		await trigger({
			model_id: id,
			status: checked ? AiModel.Status.Enabled : AiModel.Status.Disabled,
		})
		message.success(tCommon("message.updateSuccess"))
		const newModels = models.map((item) =>
			item.id === id
				? { ...item, status: checked ? AiModel.Status.Enabled : AiModel.Status.Disabled }
				: item,
		)

		setModels(newModels)
		setData((prev) => {
			if (!prev) return prev
			return {
				...prev,
				models: newModels,
			}
		})
	}

	/* 更新switch */
	const onChangeStatus = async (checked: boolean, item: AiManage.ModelInfo) => {
		if (checked) {
			await updateModelStatus(item.id, checked)
		} else {
			openModal(WarningModal, {
				open: true,
				title: t("disableModel"),
				showDeleteText: false,
				content: t("deleteModelDesc2", { name: tCommon("button.disable") }),
				okText: tCommon("button.confirmDisable"),
				onOk: async () => {
					await updateModelStatus(item.id, checked)
				},
			})
		}
	}

	/* 测试连接 */
	const checkConnection = async (model: AiManage.ModelInfo) => {
		setCurrentModel(model)
		openModal(WarningModal, {
			open: true,
			title: t("testConnection"),
			content: t("testConnectionDesc"),
			showDeleteText: false,
			dangerLevel: DangerLevel.Normal,
			okButtonProps: {
				danger: false,
			},
			okText: tCommon("button.confirm"),
			onOk: async () => {
				try {
					setLoading(true)
					const params = {
						service_provider_config_id: model?.service_provider_config_id,
						model_version: model?.model_version,
						model_id: model?.id,
					}
					const result = isOfficialOrg
						? await AIManageApi.testConnection(params)
						: await AIManageApi.testConnectionNonOfficial(params)
					setLoading(false)
					modelConnectionResultMap.current.set(model.id, result)
				} catch (error) {
					setLoading(false)
				}
			},
		})
	}

	/* 获取测试状态 */
	const getTestStatus = useMemoizedFn((id: string) => {
		const result = modelConnectionResultMap.current.get(id)

		if (result) {
			if (result.status)
				return {
					text: t("testStatusNormal"),
				}
			return { text: t("testStatusError"), error: JSON.stringify(result.message) }
		}
		return null
	})

	/* 查看错误详情 */
	const checkErrorDetail = (res: { text: string; error?: string }) => {
		openModal(FailDetailModal, {
			currentResult: res,
		})
	}

	/* 获取测试状态渲染 */
	const getTestStatusRender = (id: string) => {
		const result = getTestStatus(id)
		const isError = !!result?.error

		if (result?.text) {
			return (
				<Flex
					gap={4}
					className={cx(styles.testStatus, isError && styles.error)}
					align="center"
				>
					{isError ? (
						<IconCircleXFilled
							color="currentColor"
							size={20}
							onClick={() => {
								if (isMobile) {
									checkErrorDetail(result)
								}
							}}
						/>
					) : (
						<IconCircleCheckFilled color="currentColor" size={20} />
					)}

					{!isMobile && (
						<>
							<div>{t("testStatus", { status: result.text })}</div>
							{isError && (
								<div
									className={styles.checkDetail}
									onClick={() => checkErrorDetail(result)}
								>
									{t("checkDetail")}
								</div>
							)}
						</>
					)}
				</Flex>
			)
		}
		return null
	}

	/* 删除模型 */
	const onDeleteModel = (model: AiManage.ModelInfo) => {
		openModal(WarningModal, {
			open: true,
			title: t("deleteModel"),
			content: model.name || model.model_id,
			description: t("deleteModelDesc2", { name: tCommon("button.delete") }),
			onOk: async () => {
				await (isOfficialOrg
					? AIManageApi.deleteModel(model.id)
					: AIManageApi.deleteModelNonOfficial(model.id))
				message.success(tCommon("message.deleteSuccess"))
				setData((prev) => {
					if (!prev) return prev
					return {
						...prev,
						models: prev.models.filter((item) => item.id !== model.id),
					}
				})
			},
		})
	}

	const onAddModelOk = (res: AiManage.ModelInfo, id?: string) => {
		// 编辑
		if (id) {
			setData((prev) => {
				if (!prev) return prev
				return {
					...prev,
					models: prev.models.map((item) => (item.id === id ? res : item)),
				}
			})
		}
		// 新增
		else {
			setData((prev) => {
				if (!prev) return prev
				return {
					...prev,
					models: [...prev.models, res],
				}
			})
		}
		MagicModal.confirm({
			centered: true,
			title: t("testConnection"),
			content: t("testConnectionDesc2"),
			dangerLevel: DangerLevel.Normal,
			onOk: () => {
				checkConnection(res)
			},
		})
	}

	const openAddModelModal = (
		item: AiManage.ModelInfo | null,
		actionType: "edit" | "copy" | "create",
		modelType: AiModel.ModelTypeGroup | null,
	) => {
		openModal(AddModelModal, {
			serviceId: data?.id,
			category: data?.category,
			rawInfo: item,
			modelType,
			actionType,
			onOk: onAddModelOk,
		})
	}

	/* 编辑模型 */
	const editModel = async (item: AiManage.ModelInfo) => {
		openAddModelModal(item, "edit", null)
	}

	/* 复制模型 */
	const copyModel = async (item: AiManage.ModelInfo) => {
		const info = {
			...item,
			id: "",
			status: AiModel.Status.Disabled,
		}

		openAddModelModal(info, "copy", null)
	}

	/* 获取额外按钮 */
	const getExtra = useMemoizedFn((key) => {
		if (!isOfficial && hasEditRight) {
			return (
				<MagicButton
					type="default"
					onClick={() => {
						openAddModelModal(null, "create", key)
					}}
				>
					<IconPlus size={20} />
					{t("addModel")}
				</MagicButton>
			)
		}
		return null
	})

	return (
		<Flex gap={isMobile ? 4 : 10} vertical key={data?.id}>
			{modelGroup?.map(({ key, title, list }) => {
				return (
					<Flex gap={isMobile ? 4 : 10} vertical key={key}>
						<SubHeader
							title={title}
							description={t("modelsTotal", { num: list?.length || 0 })}
							extra={getExtra(key)}
						/>
						{list?.map((item) => (
							<BaseModelItem item={item} isLLM={isLLM} key={item.id} showModelId>
								<Flex
									gap={isMobile ? 6 : 10}
									align="center"
									style={{ flexShrink: 0 }}
								>
									{!isOfficial && (
										<>
											{getTestStatusRender(item.id)}
											<MagicButton
												size={isMobile ? "small" : "middle"}
												loading={loading && currentModel?.id === item.id}
												onClick={() => checkConnection(item)}
											>
												{t("testConnection")}
											</MagicButton>
										</>
									)}
									<MagicSwitch
										size={isMobile ? "small" : "default"}
										loading={isMutating && currentModel?.id === item.id}
										checked={item.status === AiModel.Status.Enabled}
										disabled={!hasEditRight}
										onChange={(checked) => onChangeStatus(checked, item)}
									/>
									{!isOfficial && hasEditRight && (
										<>
											<MagicButton
												size={isMobile ? "small" : "middle"}
												icon={<IconEdit size={isMobile ? 16 : 20} />}
												className={styles.button}
												onClick={() => editModel(item)}
											/>
											<MagicButton
												size={isMobile ? "small" : "middle"}
												icon={<IconCopy size={isMobile ? 16 : 20} />}
												className={styles.button}
												onClick={() => copyModel(item)}
											/>
											<MagicButton
												danger
												size={isMobile ? "small" : "middle"}
												icon={<IconTrash size={isMobile ? 16 : 20} />}
												className={styles.button}
												onClick={() => onDeleteModel(item)}
											/>
										</>
									)}
								</Flex>
							</BaseModelItem>
						))}
						{list?.length === 0 && <Empty />}
					</Flex>
				)
			})}
			{modelGroup?.length === 0 && <Empty />}
		</Flex>
	)
}

export default memo(ModalList)
