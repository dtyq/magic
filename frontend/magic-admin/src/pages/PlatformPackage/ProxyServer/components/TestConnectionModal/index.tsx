import { memo, useEffect, useMemo, useState } from "react"
import { Form } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicModalProps } from "components"
import { MagicModal, MagicInput, MagicForm } from "components"
import { PlatformPackage } from "@/types/platformPackage"
import { useStyles } from "../AddProxyServerModal/styles"
import { useTestConnect } from "../../hooks/useTestConnect"

interface TestConnectionModalProps extends MagicModalProps {
	info?: PlatformPackage.ProxyServer | null
}

export const TestConnectionModal = memo(({ info, ...rest }: TestConnectionModalProps) => {
	const { t } = useTranslation("admin/platform/proxy")
	const { styles } = useStyles()

	const [form] = Form.useForm()
	const [open, setOpen] = useState(true)

	const initialFormValues = useMemo(() => {
		if (info) {
			if (info.type === PlatformPackage.ProxyServerType.ProxyServer) {
				const [protocol, hostAndPort] = info.proxyUrl.split("://")
				const [host, port] = hostAndPort.split(":")
				return {
					...info,
					protocol,
					host,
					port,
				}
			}
			return info
		}
		return {}
	}, [info])

	useEffect(() => {
		form.setFieldsValue(initialFormValues)
	}, [form, initialFormValues])

	const { footer } = useTestConnect({ info })

	return (
		<MagicModal
			width={600}
			title={t("testConnection")}
			footer={footer}
			centered
			open={open}
			onCancel={() => setOpen(false)}
			{...rest}
		>
			<MagicForm afterRequiredMask className={styles.form} colon={false} form={form}>
				<Form.Item
					label={t("proxyProtocol")}
					name="protocol"
					required
					className={styles.formItem}
				>
					<MagicInput disabled />
				</Form.Item>

				<Form.Item label={t("server")} name="host" required className={styles.formItem}>
					<MagicInput disabled placeholder={t("pleaseInputServer")} />
				</Form.Item>

				<Form.Item label={t("port")} required name="port" className={styles.formItem}>
					<MagicInput disabled placeholder={t("pleaseInputServerPort")} />
				</Form.Item>

				<Form.Item label={t("username")} name="username" className={styles.formItem}>
					<MagicInput disabled placeholder={t("pleaseInputUsername")} />
				</Form.Item>

				<Form.Item label={t("password")} name="password" className={styles.formItem}>
					<MagicInput disabled placeholder={t("pleaseInputPassword")} />
				</Form.Item>

				{/* <Form.Item
					label={t("targetUrl")}
					required
					name="targetUrl"
					className={styles.formItem}
				>
					<MagicInput placeholder={t("pleaseInputTargetUrl")} />
				</Form.Item> */}
			</MagicForm>
		</MagicModal>
	)
})
