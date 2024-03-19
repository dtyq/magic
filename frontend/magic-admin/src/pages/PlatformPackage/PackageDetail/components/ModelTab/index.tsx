import { Flex, Form, message, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { SubHeader, MagicSwitch, MagicButton, colorUsages } from "components"
import { IconInfoCircle } from "@tabler/icons-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { forwardRef, useImperativeHandle, useState } from "react"
import { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useApis } from "@/apis"
import { useMount, useRequest } from "ahooks"
import { useSearchParams } from "react-router-dom"
import AddModelModal from "../AddModelModal"
import ModelGroup from "../ModelGroup"
import { useGetStyles } from "../../index.page"

export interface ModelTabRef {
	onCancel: () => void
	onSave: () => Promise<PlatformPackage.Package["extra"]>
}

interface ModelTabProps {
	// data?: PlatformPackage.PackageDetail
}

const ModelTab = forwardRef<ModelTabRef, ModelTabProps>((_, ref) => {
	const { t } = useTranslation("admin/platform/manage")
	const isMobile = useIsMobile()
	const styles = useGetStyles()

	const { PlatformPackageApi } = useApis()
	const openModal = useOpenModal()

	const form = Form.useFormInstance()
	const enableAllModel = Form.useWatch(["product", "extra", "enable_all_models"], form)

	const [searchParams] = useSearchParams()
	const id = searchParams.get("id")

	const [rawAvailableModels, setRawAvailableModels] = useState<
		PlatformPackage.PackageAvailableModels["available_models"] | null
	>(null) // 套餐下可用的模型原始数据
	const [availableModels, setAvailableModels] = useState<
		PlatformPackage.PackageAvailableModels["available_models"] | null
	>(null) // 套餐下可用的模型

	const { run } = useRequest(PlatformPackageApi.getPackageAvailableModels, {
		manual: true,
		onSuccess: (res) => {
			setAvailableModels(res.available_models)
			setRawAvailableModels(res.available_models)
		},
	})

	useMount(() => {
		if (!id) return
		run(id)
	})

	// useEffect(() => {
	// 	if (data?.product?.extra?.model_bindings) {
	// 		// 初始注册表单字段，使用 setFieldValue 精确设置
	// 		form.setFieldValue(
	// 			["product", "extra", "model_bindings"],
	// 			data.product.extra.model_bindings,
	// 		)
	// 	}
	// }, [data])

	const openAddModelModal = () => {
		const existingModelIds = Object.values(availableModels || {}).flatMap((models) =>
			models.map((model) => model.id),
		)

		openModal(AddModelModal, {
			existingModelIds,
			onOk: (res: AiManage.ModelInfo[]) => {
				setAvailableModels((prev) => {
					const newAvailableModels = { ...prev }
					const newModelIds: string[] = []

					res.forEach((model) => {
						const modelId = model.model_id
						if (newAvailableModels[modelId]) {
							// 检查是否已存在相同的模型（通过id判断）
							if (!existingModelIds.includes(model.id)) {
								// 如果不存在相同模型，则添加到数组后面
								newAvailableModels[modelId] = [
									...newAvailableModels[modelId],
									model,
								]
							} else {
								message.error(t("alreadyExists"))
							}
						} else {
							// 如果没有对应的key，则新增
							newAvailableModels[modelId] = [model]
							newModelIds.push(modelId)
						}
					})

					// 为新增的模型预设表单字段值
					if (newModelIds.length > 0) {
						const currentValues =
							form.getFieldValue(["product", "extra", "model_bindings"]) || {}
						const newBindings = { ...currentValues }
						newModelIds.forEach((modelId) => {
							newBindings[modelId] = {
								monthly_pricing_type: PlatformPackage.PricingType.Normal,
								yearly_pricing_type: PlatformPackage.PricingType.Normal,
								permanent_pricing_type: PlatformPackage.PricingType.Normal,
							}
						})
						// 使用 setFieldValue 精确设置字段，避免浅合并问题
						form.setFieldValue(["product", "extra", "model_bindings"], newBindings)
					}

					return newAvailableModels
				})
			},
		})
	}

	const onCancel = () => {
		setAvailableModels(rawAvailableModels)
	}

	const onSave = async () => {
		const values = await form.getFieldsValue(["product"])
		return values.product.extra
	}

	useImperativeHandle(ref, () => ({
		onCancel,
		onSave,
	}))

	return (
		<>
			{/* 可用大模型 */}
			<SubHeader
				title={t("availableModels")}
				description={
					<Flex gap={8} align="center">
						<Form.Item name={["product", "extra", "enable_all_models"]} noStyle>
							<MagicSwitch />
						</Form.Item>
						<Flex
							vertical={!isMobile}
							gap={isMobile ? 2 : 0}
							align={isMobile ? "center" : "flex-start"}
						>
							<span className={styles.subText}>{t("allModelAvailable")}</span>
							{isMobile ? (
								<Tooltip title={t("allModelAvailableDesc")}>
									<IconInfoCircle size={16} color={colorUsages.text[3]} />
								</Tooltip>
							) : (
								<span className={styles.subDesc}>{t("allModelAvailableDesc")}</span>
							)}
						</Flex>
					</Flex>
				}
				extra={
					<MagicButton
						size={isMobile ? "small" : "middle"}
						type="primary"
						onClick={openAddModelModal}
					>
						{t("addModel")}
					</MagicButton>
				}
			/>
			<ModelGroup
				enableAllModel={enableAllModel}
				modelGroupList={availableModels}
				setAvailableModels={setAvailableModels}
			/>
		</>
	)
})

export default ModelTab
