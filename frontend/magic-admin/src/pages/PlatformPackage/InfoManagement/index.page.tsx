import { Flex, Form, message } from "antd"
import { useTranslation } from "react-i18next"
import { SubHeader, MagicSwitch, MagicInput, BaseLayout } from "components"
import { useAdminStore } from "@/stores/admin"
import { useApis } from "@/apis"
import { useMount } from "ahooks"
import { useState } from "react"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { PlatformPackage } from "@/types/platformPackage"
import { useAdmin } from "@/provider/AdminProvider"
import { useStyles } from "./styles"

const InfoManagementPage = () => {
	const { t } = useTranslation("admin/platform/info")
	const { t: tCommon } = useTranslation("admin/common")
	const isMobile = useIsMobile()
	const { siderCollapsed } = useAdminStore()
	const { safeAreaInset } = useAdmin()
	const { styles } = useStyles({
		siderCollapsed,
		isMobile,
		safeAreaInsetBottom: safeAreaInset?.bottom || 0,
	})

	const { PlatformPackageApi } = useApis()

	const [globalConfig, setGlobalConfig] = useState<PlatformPackage.GlobalConfig>({
		is_maintenance: false,
		maintenance_description: "",
	})

	const [form] = Form.useForm()

	useMount(() => {
		PlatformPackageApi.getGlobalConfig().then((res) => {
			form.setFieldsValue(res)
			setGlobalConfig(res)
		})
	})

	const onSave = () => {
		const values = form.getFieldsValue()
		// console.log(values)
		PlatformPackageApi.updateGlobalConfig(values).then(() => {
			message.success(tCommon("message.saveSuccess"))
			setGlobalConfig(values)
		})
	}

	const onCancel = () => {
		form.setFieldsValue(globalConfig)
	}

	const hasEditRight = useRights(PERMISSION_KEY_MAP.INFO_MANAGEMENT_EDIT)

	return (
		<BaseLayout
			isMobile={isMobile}
			footerContainerClassName={styles.footerContainer}
			buttonGroupProps={{
				okProps: {
					onClick: onSave,
					disabled: !hasEditRight,
				},
				cancelProps: {
					onClick: onCancel,
					disabled: !hasEditRight,
				},
			}}
		>
			<Form layout="vertical" colon={false} className={styles.container} form={form}>
				<SubHeader title={t("globalMaintain")} />
				<Flex vertical className={styles.formWrapper}>
					<Form.Item label={t("maintainStatus")} name="is_maintenance">
						<MagicSwitch />
					</Form.Item>
					<Form.Item label={t("maintainDesc")} name="maintenance_description">
						<MagicInput.TextArea rows={4} placeholder={tCommon("pleaseInput")} />
					</Form.Item>
				</Flex>
			</Form>
		</BaseLayout>
	)
}

export default InfoManagementPage
