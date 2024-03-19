import type { MagicModalProps } from "components"
import { MagicModal } from "components"
import { useTranslation } from "react-i18next"
import { Button, Form, InputNumber, message, TreeSelect } from "antd"
import { useMemo, useState } from "react"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import type { DataNode } from "antd/es/tree"
import { IconChevronDown } from "@tabler/icons-react"
import { useApis } from "@/apis"
import { PlatformPackage } from "@/types/platformPackage"
import type { OpenableProps } from "@/hooks/useOpenModal"
import type { AiManage } from "@/types/aiManage"

interface BindPackageModalProps extends OpenableProps<MagicModalProps> {
	selectedOrganization: PlatformPackage.OrgPointsList | null
	afterClose?: () => void
}

interface Node extends DataNode {
	plan_type?: PlatformPackage.PackageType
}

const params: AiManage.GetProductListWithSkuParams = {
	category: 1,
	page: 1,
	page_size: 100,
}

const BindPackageModal = ({
	selectedOrganization,
	onClose,
	afterClose,
	...props
}: BindPackageModalProps) => {
	const { t } = useTranslation("admin/platform/points")
	const { t: tManage } = useTranslation("admin/platform/manage")
	const [form] = Form.useForm()

	const { PlatformPackageApi } = useApis()
	const [open, setOpen] = useState(true)
	const [packageOptions, setPackageOptions] = useState<Node[]>([])
	const [selectedPackage, setSelectedPackage] = useState<Node | null>(null)
	const [currentPackageInfo, setCurrentPackageInfo] = useState<AiManage.ProductListWithSkuItem>()

	const { AIManageApi } = useApis()

	const isPerson = useMemo(() => {
		return selectedOrganization?.type === PlatformPackage.OrganizationType.Person
	}, [selectedOrganization])

	// 当前套餐ID
	const currentPackageId = useMemo(() => {
		const productSkuPattern = /product:(\d+):sku:(\d+)/
		return selectedOrganization?.current_plan?.match(productSkuPattern)?.[1]
	}, [selectedOrganization])

	const getTypeName = useMemoizedFn((type: PlatformPackage.SubscriptionType) => {
		switch (type) {
			case PlatformPackage.SubscriptionType.Monthly:
				return tManage("monthlySubscription")
			case PlatformPackage.SubscriptionType.Yearly:
				return tManage("yearlySubscription")
			case PlatformPackage.SubscriptionType.Permanent:
				return tManage("permanentSubscription")
			default:
				return ""
		}
	})

	const isPackageTypeDisabled = useMemoizedFn((planType?: PlatformPackage.PackageType) => {
		if (!selectedOrganization || !planType) return false
		const { type: orgType } = selectedOrganization
		return (
			(orgType === PlatformPackage.OrganizationType.Enterprise &&
				planType === PlatformPackage.PackageType.Personal) ||
			(orgType === PlatformPackage.OrganizationType.Person &&
				(planType === PlatformPackage.PackageType.Enterprise ||
					planType === PlatformPackage.PackageType.Team))
		)
	})

	const { run: getProductList } = useRequest(
		(arg: AiManage.GetProductListWithSkuParams) => AIManageApi.getProductListWithSku(arg),
		{
			manual: true,
			onSuccess: (res) => {
				const currentPackage = currentPackageId
					? res?.list?.find((item) => item.product.id === currentPackageId)
					: null
				if (currentPackage) {
					setCurrentPackageInfo(currentPackage)
				}
				const options = res?.list?.map((item) => {
					const children = item.skus.map((sku) => ({
						key: sku.id,
						title: `【${getTypeName(sku.attributes.subscription_type)}】 ${sku.name}`,
						value: sku.id,
						plan_type: sku.attributes.plan_type,
						disabled:
							isPackageTypeDisabled(sku.attributes.plan_type) ||
							(!!currentPackage &&
								item.product.sort <= (currentPackage?.product.sort ?? 0) &&
								currentPackageId !== item.product.id),
					}))

					// 检查所有子节点是否都被禁用
					const allChildrenDisabled = children.every((child) => child.disabled)

					return {
						key: item.product.id,
						title: `【${item.product.enable ? t("organizationPointsPage.modal.enable") : t("organizationPointsPage.modal.disable")}】 ${item.product.name}`,
						value: item.product.id,
						selectable: false, // 父节点不可选择
						disabled: allChildrenDisabled, // 所有子节点都禁用时，父节点也禁用
						children,
					}
				})
				setPackageOptions(options)
			},
		},
	)

	useMount(() => {
		getProductList(params)
	})

	const onCancel = () => {
		setOpen(false)
		onClose?.()
	}

	// 处理绑定套餐提交
	const handleBindPackageSubmit = async (values: PlatformPackage.BindPackageParams) => {
		if (!selectedOrganization) return

		MagicModal.confirm({
			centered: true,
			title: t("organizationPointsPage.modal.confirmBindPackageTitle"),
			content: isPerson
				? t("organizationPointsPage.modal.confirmBindPackageContentPerson", {
						organization: selectedOrganization.organization_name,
						packageName: selectedPackage?.title || "",
					})
				: t("organizationPointsPage.modal.confirmBindPackageContent", {
						organization: selectedOrganization.organization_name,
						packageName: selectedPackage?.title || "",
						seatCount: values.seat_count,
					}),
			onOk: async () => {
				try {
					await PlatformPackageApi.bindPackage({
						organization_codes: [selectedOrganization.organization_code],
						product_sku_id: values.product_sku_id,
						seat_count: values.seat_count,
					})

					message.success(t("organizationPointsPage.message.bindPackageSuccess"))
					onCancel()
					afterClose?.()
				} catch (error) {
					message.error(t("organizationPointsPage.message.operationFailed"))
				} finally {
					onCancel()
				}
			},
		})
	}

	return (
		<MagicModal
			centered
			title={t("organizationPointsPage.modal.bindPackageTitle")}
			footer={null}
			width={500}
			open={open}
			onCancel={onCancel}
			{...props}
		>
			{selectedOrganization && (
				<div style={{ marginBottom: 16 }}>
					<p>
						<strong>{t("organizationPointsPage.modal.organizationNameLabel")}: </strong>
						{selectedOrganization.organization_name}
					</p>
					<p>
						<strong>{t("organizationPointsPage.modal.organizationCodeLabel")}: </strong>
						{selectedOrganization.organization_code}
					</p>
					<p>
						<strong>{t("organizationPointsPage.modal.organizationTypeLabel")}: </strong>
						{selectedOrganization.type === PlatformPackage.OrganizationType.Enterprise
							? t("organizationPointsPage.columns.enterpriseVersion")
							: t("organizationPointsPage.columns.personalVersion")}
					</p>
					{currentPackageInfo && (
						<>
							<p>
								<strong>
									{t("organizationPointsPage.modal.currentPlanLabel")}:{" "}
								</strong>
								{currentPackageInfo?.product.name}
							</p>
							<p>
								<strong>{t("organizationPointsPage.modal.sortLabel")}: </strong>
								{currentPackageInfo?.product.sort}
							</p>
						</>
					)}
				</div>
			)}

			<Form form={form} layout="vertical" onFinish={handleBindPackageSubmit}>
				<Form.Item
					name="product_sku_id"
					label={t("organizationPointsPage.modal.packageLabel")}
					tooltip={t("organizationPointsPage.modal.tooltipTitle")}
					rules={[
						{
							required: true,
							message: t("organizationPointsPage.modal.packageRequired"),
						},
					]}
				>
					<TreeSelect
						placeholder={t("organizationPointsPage.modal.pleaseSelectPackage")}
						treeData={packageOptions}
						suffixIcon={<IconChevronDown size={16} />}
						allowClear
						onSelect={(_, option) => {
							setSelectedPackage(option)
						}}
					/>
				</Form.Item>

				<Form.Item
					name="seat_count"
					label={t("organizationPointsPage.modal.seatCountLabel")}
					hidden={isPerson}
					rules={[
						{
							required: true,
							message: t("organizationPointsPage.modal.seatCountRequired"),
						},
						{
							type: "number",
							min: 0,
							message: t("organizationPointsPage.modal.seatCountMin"),
						},
					]}
					initialValue={1}
				>
					<InputNumber
						style={{ width: "100%" }}
						placeholder={t("organizationPointsPage.modal.seatCountPlaceholder")}
						min={1}
						precision={0}
					/>
				</Form.Item>

				<Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
					<Button onClick={onCancel} style={{ marginRight: 8 }}>
						{t("organizationPointsPage.modal.cancelButton")}
					</Button>
					<Button type="primary" htmlType="submit">
						{t("organizationPointsPage.modal.confirmButton")}
					</Button>
				</Form.Item>
			</Form>
		</MagicModal>
	)
}

export default BindPackageModal
