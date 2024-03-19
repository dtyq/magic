import { memo, useState, useRef, useMemo } from "react"
import { Flex, Form, message, Segmented } from "antd"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { BaseLayout, MagicForm } from "components"
import { useSearchParams } from "react-router-dom"
import type { PlatformPackage } from "@/types/platformPackage"
import { useApis } from "@/apis"
import { useAdminStore } from "@/stores/admin"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { useIsMobile } from "@/hooks/useIsMobile"
import { RouteName } from "@/const/routes"
import useNavigate from "@/hooks/useNavigate"
import { useAdmin } from "@/provider/AdminProvider"
import { useStyles } from "./styles"
import type { BasicTabRef } from "./components/BasicTab"
import BasicTab from "./components/BasicTab"
import type { ModelTabRef } from "./components/ModelTab"
import ModelTab from "./components/ModelTab"

export const useGetStyles = () => {
	const { i18n } = useTranslation()
	const isMobile = useIsMobile()
	const { siderCollapsed } = useAdminStore()
	const lang = i18n.language
	const { safeAreaInset } = useAdmin()
	const { styles } = useStyles({
		siderCollapsed,
		isZh: lang === "zh_CN",
		isMobile,
		safeAreaInsetBottom: safeAreaInset?.bottom || 0,
	})
	return styles
}

/* 套餐详情 */
const PackageDetail = memo(() => {
	const isMobile = useIsMobile()
	const { t } = useTranslation("admin/platform/manage")
	const { t: tCommon } = useTranslation("admin/common")
	const styles = useGetStyles()

	const { PlatformPackageApi } = useApis()

	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const id = searchParams.get("id")
	const type = searchParams.get("type")

	const basicTabRef = useRef<BasicTabRef>(null)
	const modelTabRef = useRef<ModelTabRef>(null)

	const [form] = Form.useForm()

	const [activeTab, setActiveTab] = useState<"basic" | "model">("basic")
	const [saving, setSaving] = useState<boolean>(false)

	const { run: getServiceProviderDetailData, data } = useRequest(
		PlatformPackageApi.getPackageDetail,
		{
			manual: true,
			onSuccess: (res) => {
				form.setFieldValue(
					["product", "extra", "model_bindings"],
					res.product.extra.model_bindings,
				)
			},
		},
	)

	useMount(() => {
		if (!id) return
		getServiceProviderDetailData(id)
	})

	const onSave = useMemoizedFn(async () => {
		try {
			if (saving) return
			setSaving(true)
			const isBasicTab = activeTab === "basic"

			// 编辑
			if (data) {
				let newValues = null

				if (isBasicTab) {
					const values = await basicTabRef.current?.onSave?.()
					if (!values) return

					// console.log(values)
					// 保存基础信息
					newValues = {
						...values,
						product: {
							...(values.product || {}),
							extra: {
								...data.product.extra,
								level: values.product.extra.level,
							},
						},
					}
				} else {
					const values = await modelTabRef.current?.onSave?.()
					if (!values) return

					// 只更新套餐下可用的模型
					newValues = {
						...data,
						product: {
							...data.product,
							// 套餐下可用的模型
							extra: values,
						},
					}
				}
				// console.log(newValues)
				PlatformPackageApi.updatePackageInfo(
					data.product.id,
					newValues as PlatformPackage.PackageDetail,
				).then(() => {
					message.success(tCommon("message.saveSuccess"))
					navigate({ name: RouteName.AdminPackageManage })
				})
			} else {
				basicTabRef.current
					?.onSave?.()
					.then((values) => {
						if (!values && !isBasicTab) {
							setActiveTab("basic")
							return
						}
						if (values) {
							PlatformPackageApi.addPackage(values).then(() => {
								message.success(tCommon("message.saveSuccess"))
								navigate({ name: RouteName.AdminPackageManage })
							})
						}
					})
					.catch(() => {
						setActiveTab("basic")
					})
			}
		} catch (error) {
			message.error(tCommon("message.pleaseInputRequiredFields"))
			setActiveTab("basic")
		} finally {
			setSaving(false)
		}
	})

	const onCancel = useMemoizedFn(() => {
		if (activeTab === "basic") {
			basicTabRef.current?.onCancel?.()
		} else {
			modelTabRef.current?.onCancel?.()
		}
	})

	const hasEditRight = useRights(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_EDIT)

	const tabOptions = useMemo(
		() => [
			{
				value: "basic" as const,
				label: t("packageInfo"),
			},
			{
				value: "model" as const,
				label: t("availableModel"),
			},
		],
		[t],
	)

	return (
		<BaseLayout
			isMobile={isMobile}
			footerContainerClassName={styles.footerContainer}
			contentClassName={styles.basicContent}
			buttonGroupProps={{
				okProps: {
					onClick: onSave,
					disabled: !hasEditRight,
					loading: saving,
				},
				cancelProps: {
					onClick: onCancel,
					disabled: !hasEditRight,
				},
			}}
		>
			<Flex vertical gap={20} justify="center" className={styles.container}>
				<Segmented
					value={activeTab}
					onChange={setActiveTab}
					className={styles.segmented}
					options={tabOptions}
				/>
				<MagicForm afterRequiredMask colon={false} className={styles.content} form={form}>
					<div className={styles.tabContent} data-active={activeTab === "basic"}>
						<BasicTab data={data} ref={basicTabRef} type={type} />
					</div>
					<div className={styles.tabContent} data-active={activeTab === "model"}>
						<ModelTab ref={modelTabRef} />
					</div>
				</MagicForm>
			</Flex>
		</BaseLayout>
	)
})

export default PackageDetail
