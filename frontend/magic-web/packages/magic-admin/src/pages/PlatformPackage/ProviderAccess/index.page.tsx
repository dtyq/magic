import { Form, message } from "antd"
import { useTranslation } from "react-i18next"
import { SubHeader, MagicInput, BaseLayout } from "@admin-components"
import { useApis } from "@admin/apis"
import { useMount, useMemoizedFn } from "ahooks"
import { useState } from "react"
import useRights from "@admin/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import { useIsMobile } from "@admin/hooks/useIsMobile"
import type { PlatformInfo } from "@admin/types/platformInfo"
import { useAdmin } from "@admin/provider/AdminProvider"
import { useAdminStore } from "@admin/stores/admin"
import { useStyles } from "../InfoManagement/styles"

const formatWhitelist = (whitelist?: string[]) => whitelist?.join(",") || ""

const ProviderAccessPagePage = () => {
	const { t: tPlatform } = useTranslation("admin/platform/info")
	const { t: tCommon } = useTranslation("admin/common")
	const isMobile = useIsMobile()
	const { siderCollapsed } = useAdminStore()
	const { safeAreaInset } = useAdmin()
	const { styles } = useStyles({
		siderCollapsed,
		isMobile,
		safeAreaInsetBottom: safeAreaInset?.bottom || 0,
	})

	const { PlatformInfoApi } = useApis()
	const [form] = Form.useForm()
	const [loading, setLoading] = useState(false)
	const [detail, setDetail] = useState<PlatformInfo.Details | null>(null)

	const hasEditRight = useRights(PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT)

	const initPlatformInfo = useMemoizedFn(async () => {
		const res = await PlatformInfoApi.getPlatformInfo()
		if (!res) return
		setDetail(res)
		form.setFieldsValue({
			custom_service_provider_whitelist: formatWhitelist(
				res.custom_service_provider_whitelist,
			),
		})
	})

	useMount(() => {
		initPlatformInfo()
	})

	const onSave = useMemoizedFn(async () => {
		if (loading || !detail) return
		try {
			setLoading(true)
			const values = form.getFieldsValue()
			const whitelistValue =
				typeof values.custom_service_provider_whitelist === "string"
					? values.custom_service_provider_whitelist
					: ""
			const customServiceProviderWhitelist = whitelistValue
				? whitelistValue
						.trim()
						.split(",")
						.map((item: string) => item.trim())
						.filter(Boolean)
				: []

			await PlatformInfoApi.updatePlatformInfo({
				custom_service_provider_whitelist: customServiceProviderWhitelist,
			})
			message.success(tCommon("message.saveSuccess"))
			initPlatformInfo()
		} finally {
			setLoading(false)
		}
	})

	const onCancel = useMemoizedFn(() => {
		form.setFieldsValue({
			custom_service_provider_whitelist: formatWhitelist(
				detail?.custom_service_provider_whitelist,
			),
		})
	})

	return (
		<BaseLayout
			isMobile={isMobile}
			footerContainerClassName={styles.footerContainer}
			buttonGroupProps={{
				okProps: {
					onClick: onSave,
					loading,
					disabled: !hasEditRight,
				},
				cancelProps: {
					onClick: onCancel,
					disabled: !hasEditRight,
				},
			}}
		>
			<Form layout="vertical" colon={false} className={styles.container} form={form}>
				<SubHeader title={tCommon("nav.platformSubMenu.providerAccess")} />
				<div className={styles.formWrapper}>
					<Form.Item
						name="custom_service_provider_whitelist"
						label={tPlatform("customServiceProviderWhitelist")}
					>
						<MagicInput.TextArea
							rows={4}
							placeholder={tPlatform("customServiceProviderWhitelistPlaceholder")}
						/>
					</Form.Item>
				</div>
			</Form>
		</BaseLayout>
	)
}

export default ProviderAccessPagePage
