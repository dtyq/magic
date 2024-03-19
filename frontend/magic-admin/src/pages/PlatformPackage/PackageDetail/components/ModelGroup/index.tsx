import { Flex, Form, Popover } from "antd"
import { memo, useMemo, useState } from "react"
import { PlatformPackage } from "@/types/platformPackage"
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { MagicSelect, WarningModal, MagicButton, MagicCollapse } from "components"
import { isEmpty } from "lodash-es"
import { useMemoizedFn } from "ahooks"
import { useOpenModal } from "@/hooks/useOpenModal"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useIsMobile } from "@/hooks/useIsMobile"
import { AddModelModal } from "../../../components/ModalList/components/AddModelModal"
import BaseModelItem from "../../../components/ModalList/components/BaseModelItem"
import { useStyles } from "./styles"

// 套餐配置，月/年/永久计费选择表单项
const ModelPricingFormItem = ({
	subscriptionType,
	modelId,
}: {
	subscriptionType: PlatformPackage.SubscriptionType[]
	modelId: string
}) => {
	const { t } = useTranslation("admin/platform/manage")
	const { styles } = useStyles()

	const options = useMemo(() => {
		return [
			{ label: t("normalBilling"), value: PlatformPackage.PricingType.Normal },
			{ label: t("free"), value: PlatformPackage.PricingType.Free },
			{ label: t("unavailable"), value: PlatformPackage.PricingType.Unavailable },
		]
	}, [t])

	if (!subscriptionType || !subscriptionType.length) {
		return (
			<Flex justify="center" className={styles.emptySubscription}>
				{t("noSubscriptionDesc")}
			</Flex>
		)
	}

	return (
		<Flex gap={20} className={styles.emptySubscription}>
			<Form.Item
				label={t("monthlySubscription")}
				name={["product", "extra", "model_bindings", modelId, "monthly_pricing_type"]}
				className={styles.formItem}
				initialValue={PlatformPackage.PricingType.Normal}
				hidden={!subscriptionType.includes(PlatformPackage.SubscriptionType.Monthly)}
			>
				<MagicSelect options={options} popupMatchSelectWidth={false} />
			</Form.Item>
			<Form.Item
				label={t("yearlySubscription")}
				name={["product", "extra", "model_bindings", modelId, "yearly_pricing_type"]}
				className={styles.formItem}
				initialValue={PlatformPackage.PricingType.Normal}
				hidden={!subscriptionType.includes(PlatformPackage.SubscriptionType.Yearly)}
			>
				<MagicSelect options={options} popupMatchSelectWidth={false} />
			</Form.Item>
			<Form.Item
				label={t("permanentSubscription")}
				name={["product", "extra", "model_bindings", modelId, "permanent_pricing_type"]}
				className={styles.formItem}
				initialValue={PlatformPackage.PricingType.Normal}
				hidden={!subscriptionType.includes(PlatformPackage.SubscriptionType.Permanent)}
			>
				<MagicSelect options={options} popupMatchSelectWidth={false} />
			</Form.Item>
		</Flex>
	)
}

interface ModelGroupProps {
	/* 套餐下可用的模型 */
	modelGroupList?: PlatformPackage.PackageAvailableModels["available_models"] | null
	/* 更新套餐下可用的模型 */
	setAvailableModels: React.Dispatch<
		React.SetStateAction<PlatformPackage.PackageAvailableModels["available_models"] | null>
	>
	enableAllModel: boolean
}

const ModelGroup = memo(
	({ modelGroupList, setAvailableModels, enableAllModel }: ModelGroupProps) => {
		const isMobile = useIsMobile()
		const { t } = useTranslation("admin/platform/manage")
		const { styles } = useStyles()
		const openModal = useOpenModal()

		const formInstance = Form.useFormInstance()
		const subscriptionType = Form.useWatch(
			["skus", "attributes", "subscription_type"],
			formInstance,
		)

		const [currentModelInfo, setCurrentModelInfo] = useState<AiManage.ModelInfo | null>(null)

		const onDelete = useMemoizedFn((key: string) => {
			openModal(WarningModal, {
				open: true,
				content: key,
				onOk: () => {
					// 删除模型组
					setAvailableModels((prev) => {
						if (!prev) return null
						const newModels = { ...prev }
						delete newModels[key]
						return newModels
					})

					// 同步删除表单中对应的 model_bindings 字段
					const currentBindings =
						formInstance.getFieldValue(["product", "extra", "model_bindings"]) || {}
					const newBindings = { ...currentBindings }
					// console.log(newBindings, "newBindings")
					delete newBindings[key]
					// 使用 setFieldValue 精确设置字段，避免浅合并问题
					formInstance.setFieldValue(["product", "extra", "model_bindings"], newBindings)
				},
			})
		})

		const onAddModelOk = (res: AiManage.ModelInfo, id?: string) => {
			// 编辑
			if (id) {
				setAvailableModels((prev) => {
					if (!prev) return prev
					const newModels = { ...prev }
					// 前后模型标识相同，直接替换
					if (currentModelInfo?.model_id === res.model_id) {
						newModels[res.model_id] = newModels[res.model_id].map((item) =>
							item.id === id ? res : item,
						)
					} else if (currentModelInfo) {
						// 前后更换了模型标识，需要删除旧的模型，新增新的模型
						const oldModels = newModels[currentModelInfo.model_id].filter(
							(item) => item.id !== id,
						)
						const oldModelIdDeleted = oldModels.length === 0

						// 旧的模型组有模型，保留旧的模型组
						if (oldModels.length > 0) {
							newModels[currentModelInfo.model_id] = oldModels
						} else {
							// 旧的模型组被完全删除，删除对应的表单字段
							delete newModels[currentModelInfo.model_id]
						}

						const isNewModelId = !newModels[res.model_id]
						newModels[res.model_id] = [...(newModels[res.model_id] || []), res]

						// 同步更新表单中的 model_bindings
						const currentBindings =
							formInstance.getFieldValue(["product", "extra", "model_bindings"]) || {}
						const newBindings = { ...currentBindings }

						// 如果旧的 model_id 组被完全删除，删除对应的表单字段
						if (oldModelIdDeleted) {
							delete newBindings[currentModelInfo.model_id]
						}

						// 如果是新的 model_id，创建对应的表单字段
						if (isNewModelId) {
							newBindings[res.model_id] = {
								monthly_pricing_type: PlatformPackage.PricingType.Normal,
								yearly_pricing_type: PlatformPackage.PricingType.Normal,
								permanent_pricing_type: PlatformPackage.PricingType.Normal,
							}
						}

						formInstance.setFieldValue(
							["product", "extra", "model_bindings"],
							newBindings,
						)
					}

					return newModels
				})
			}
		}

		const checkModelDetail = useMemoizedFn((model: AiManage.ModelInfo) => {
			setCurrentModelInfo(model)
			openModal(AddModelModal, {
				rawInfo: model,
				serviceId: model.service_provider_config_id,
				category: AiModel.ServiceProviderCategory.LLM,
				onOk: onAddModelOk,
			})
		})

		const groups = useMemo(() => {
			if (!modelGroupList || isEmpty(modelGroupList)) return []
			return Object.entries(modelGroupList).map(([key, models]) => {
				return {
					key,
					label: (
						<Flex justify="space-between" align="center">
							<Flex gap={10} align="center">
								{isMobile ? (
									<Popover
										trigger="click"
										content={
											<Flex vertical gap={4}>
												<span>{key}</span>
												<span className={styles.tag}>
													{t("relatedModels", { count: models.length })}
												</span>
											</Flex>
										}
									>
										<span
											className={styles.text}
											onClick={(e) => {
												e.preventDefault()
												e.stopPropagation()
											}}
										>
											{key}
										</span>
									</Popover>
								) : (
									<span className={styles.text}>{key}</span>
								)}
								{!isMobile && (
									<span className={styles.tag}>
										{t("relatedModels", { count: models.length })}
									</span>
								)}
							</Flex>
							<MagicButton
								type="text"
								icon={<IconTrash size={20} />}
								danger
								onClick={(e) => {
									e.stopPropagation()
									onDelete(key)
								}}
							/>
						</Flex>
					),
					children: (
						<Flex vertical gap={10}>
							<ModelPricingFormItem
								subscriptionType={subscriptionType}
								modelId={key}
							/>
							{models.map((model) => (
								<BaseModelItem
									item={model}
									isLLM
									key={model.id}
									className={model.status === 0 ? styles.disabledModelItem : ""}
								>
									<MagicButton
										size="small"
										disabled={model.status === 0}
										onClick={() => checkModelDetail(model)}
									>
										{t("checkDetail")}
									</MagicButton>
								</BaseModelItem>
							))}
						</Flex>
					),
				}
			})
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [modelGroupList, isMobile, subscriptionType, onDelete, checkModelDetail, t])

		return (
			<Flex vertical className={styles.container} gap={10}>
				{groups.length ? (
					<MagicCollapse
						items={groups}
						size="small"
						expandIconPosition="start"
						className={styles.collapse}
						// 优化：只展开第一个面板，按需加载其他面板以提升性能
						defaultActiveKey={groups.length > 0 ? [groups[0].key] : []}
						expandIcon={({ isActive }) =>
							isActive ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />
						}
					/>
				) : (
					<div className={styles.empty}>
						{enableAllModel ? t("emptyPackageDesc") : t("emptyModel")}
					</div>
				)}
			</Flex>
		)
	},
)

export default ModelGroup
