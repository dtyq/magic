import { Col, Divider, Flex, message, Row } from "antd"
import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconDiamondFilled, IconPlus } from "@tabler/icons-react"
import { useMount, useRequest } from "ahooks"
import { useApis } from "@/apis"
import { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import { useOpenModal } from "@/hooks/useOpenModal"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { MagicSwitch, WarningModal } from "components"
import { RouteName } from "@/const/routes"
import useNavigate from "@/hooks/useNavigate"
import PageLoading from "../components/PageLoading"
import { useStyles } from "./styles"

const PackageManagementPage = () => {
	const { t } = useTranslation("admin/platform/manage")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles, cx } = useStyles()
	const navigate = useNavigate()
	const openModal = useOpenModal()

	const { PlatformPackageApi, AIManageApi } = useApis()

	const hasEditRight = useRights(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_EDIT)

	const [list, setList] = useState<AiManage.ProductListWithSkuItem[]>([])

	const { run: getProductList, loading } = useRequest(
		(arg: AiManage.GetProductListWithSkuParams) => AIManageApi.getProductListWithSku(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setList(res.list.sort((a, b) => a.product.sort - b.product.sort))
			},
		},
	)

	useMount(() => {
		getProductList({
			category: 1,
			page: 1,
			page_size: 100,
		})
	})

	const onChange = async (checked: boolean, id: string) => {
		await PlatformPackageApi.updatePackageStatus(id, { status: checked })
		message.success(tCommon("message.updateSuccess"))
		setList((prevList) =>
			prevList.map((it) =>
				it.product.id === id
					? {
							...it,
							enable: checked,
						}
					: it,
			),
		)
	}

	const openDetail = ({ id, type }: { id?: string; type?: PlatformPackage.PackageType }) => {
		if (id) {
			navigate({ name: RouteName.AdminPackageDetail, query: { id } })
		} else {
			navigate({ name: RouteName.AdminPackageDetail, query: { type: type ?? "" } })
		}
	}

	const onDelete = async (deletePackage: AiManage.ProductListWithSkuItem["product"]) => {
		if (!deletePackage) return
		openModal(WarningModal, {
			open: true,
			content: deletePackage.name,
			onOk: () => {
				PlatformPackageApi.deletePackage(deletePackage.id).then(() => {
					message.success(tCommon("message.deleteSuccess"))
					setList((prevList) =>
						prevList.filter((it) => it.product.id !== deletePackage.id),
					)
				})
			},
		})
	}

	const AddServiceComp = memo(({ type }: { type: PlatformPackage.PackageType }) => {
		return (
			<Flex
				vertical
				gap={8}
				className={styles.addService}
				align="center"
				justify="center"
				onClick={() => openDetail({ type })}
			>
				<IconPlus size={30} />
				<div>{t("addNewPackage")}</div>
			</Flex>
		)
	})

	const content = useMemo(() => {
		return [
			{
				id: PlatformPackage.PackageType.Personal,
				title: t("personal"),
				data: list?.filter(
					(item) =>
						item.skus?.[0]?.attributes.plan_type ===
						PlatformPackage.PackageType.Personal,
				),
			},
			{
				id: PlatformPackage.PackageType.Team,
				title: t("team"),
				data: list?.filter(
					(item) =>
						item.skus?.[0]?.attributes.plan_type === PlatformPackage.PackageType.Team,
				),
			},
			{
				id: PlatformPackage.PackageType.Enterprise,
				title: t("enterprise"),
				data: list?.filter(
					(item) =>
						item.skus?.[0]?.attributes.plan_type ===
						PlatformPackage.PackageType.Enterprise,
				),
			},
		]
	}, [list, t])

	if (loading) return <PageLoading />

	return (
		<Flex vertical gap={10} className={styles.container}>
			{content.map(({ id, title, data }) => {
				return (
					<Flex gap={10} vertical key={id}>
						<div className={styles.title}>
							{title} ({data?.length})
						</div>
						<Row gutter={[10, 10]} wrap>
							{data?.map((item) => (
								<Col xs={24} sm={24} md={12} lg={8} xl={6} key={item.product.id}>
									<Flex
										vertical
										gap={12}
										className={styles.card}
										onClick={() => openDetail({ id: item.product.id })}
									>
										<Flex gap={8}>
											<Flex
												align="center"
												justify="center"
												className={styles.avatar}
											>
												<IconDiamondFilled size={24} color="#fff" />
											</Flex>
											<Flex vertical gap={4}>
												<div className={styles.title}>
													{item.product.name}
												</div>
												<div className={styles.description}>
													{item.product.subtitle}
												</div>
											</Flex>
										</Flex>
										<Divider className={styles.divider} />
										<Flex justify="space-between" align="center">
											<Flex gap={6} align="center">
												<div
													className={styles.link}
													onClick={() =>
														openDetail({ id: item.product.id })
													}
												>
													{t("setPackageName")}
												</div>
												{hasEditRight && (
													<div
														className={cx(
															styles.link,
															styles.dangerLink,
														)}
														onClick={(e) => {
															e.stopPropagation()
															onDelete(item.product)
														}}
													>
														{t("deletePackage")}
													</div>
												)}
											</Flex>
											<Flex gap={8} align="center">
												<div className={styles.status}>{t("status")}</div>
												<MagicSwitch
													size="small"
													defaultChecked={item.product.enable}
													disabled={!hasEditRight}
													onChange={(checked, e) => {
														e.stopPropagation()
														onChange?.(checked, item.product.id)
													}}
												/>
											</Flex>
										</Flex>
									</Flex>
								</Col>
							))}
							{hasEditRight && (
								<Col xs={24} sm={24} md={12} lg={8} xl={6}>
									<AddServiceComp type={id} />
								</Col>
							)}
						</Row>
					</Flex>
				)
			})}
		</Flex>
	)
}

export default PackageManagementPage
