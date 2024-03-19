import { memo, useEffect, useMemo, useState } from "react"
import { Form, message, Radio } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicModalProps } from "components"
import { MagicSelect, MagicModal, MagicInput, MagicForm } from "components"
import useFormChangeDetection from "@/hooks/useFormChangeDetection"
import { useMemoizedFn } from "ahooks"
import { PlatformPackage } from "@/types/platformPackage"
import { useApis } from "@/apis"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useStyles } from "./styles"
import { validatorHost } from "./validator"
import { useTestConnect } from "../../hooks/useTestConnect"

const protocolOptions = [
	{ label: "HTTP", value: "http" },
	{ label: "HTTPS", value: "https" },
	{ label: "Socket5", value: "socks5" },
	{ label: "Socks5h", value: "socks5h" },
]

interface AddProxyServerModalProps extends OpenableProps<MagicModalProps> {
	info?: PlatformPackage.ProxyServer | null
}

export const AddProxyServerModal = memo(
	({ info, onOk, onClose, ...rest }: AddProxyServerModalProps) => {
		const { t } = useTranslation("admin/platform/proxy")
		const { t: tCommon } = useTranslation("admin/common")

		const { styles } = useStyles()

		const { PlatformPackageApi } = useApis()

		const [open, setOpen] = useState(true)
		const [form] = Form.useForm()

		const type = Form.useWatch("type", form)

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
			return {
				type: PlatformPackage.ProxyServerType.ProxyServer,
				name: "",
				remark: "",
				protocol: "socks5",
				host: "",
				port: "",
				username: "",
				password: "",
			}
		}, [info])

		useEffect(() => {
			form.setFieldsValue(initialFormValues)
		}, [initialFormValues, form])

		const proxyDurationOptions = useMemo(() => {
			return [
				{ label: t("shortTerm"), value: PlatformPackage.ProxyDuration.ShortTerm },
				{ label: t("longTerm"), value: PlatformPackage.ProxyDuration.LongTerm },
			]
		}, [t])

		const proxyRegionOptions = useMemo(() => {
			return [
				{ label: t("china"), value: PlatformPackage.ProxyRegion.China },
				{ label: t("global"), value: PlatformPackage.ProxyRegion.Global },
			]
		}, [t])

		// 使用表单变更检测hook
		const { hasChanges, resetChangeDetection } = useFormChangeDetection({
			form,
			initialValues: initialFormValues,
		})

		const onInnerCancel = useMemoizedFn(() => {
			if (hasChanges) {
				MagicModal.confirm({
					centered: true,
					title: tCommon("confirmClose"),
					content: tCommon("unsavedChanges"),
					onOk: () => {
						form.resetFields()
						setOpen(false)
						onClose?.()
					},
				})
			} else {
				setOpen(false)
				onClose?.()
			}
		})

		const onInnerOk = useMemoizedFn(async (e) => {
			try {
				const values = await form.validateFields()
				const newValues =
					values.type === PlatformPackage.ProxyServerType.ProxyServer
						? {
								type: values.type,
								name: values.name,
								remark: values.remark,
								username: values.username,
								proxy_url: `${values.protocol}://${values.host}:${values.port}`,
								...(values.password.startsWith("***")
									? {}
									: { password: values.password }),
							}
						: values

				if (info) {
					await PlatformPackageApi.updateProxy(info.id, newValues)
					message.success(tCommon("message.updateSuccess"))
				} else {
					await PlatformPackageApi.createProxy(newValues)
					message.success(tCommon("message.createSuccess"))
				}
				setOpen(false)
				onOk?.(e)
			} catch (error) {
				// console.log(error)
			} finally {
				setOpen(false)
				onClose?.()
			}
		})

		const afterClose = useMemoizedFn(() => {
			form.resetFields()
			resetChangeDetection()
		})

		const { footer } = useTestConnect({ info, justify: "flex-end" })

		return (
			<MagicModal
				width={600}
				open={open}
				title={info ? t("editProxyServer") : t("addProxyServer")}
				okText={tCommon("button.save")}
				onCancel={onInnerCancel}
				onOk={onInnerOk}
				afterClose={afterClose}
				centered
				destroyOnHidden
				{...rest}
			>
				<MagicForm afterRequiredMask className={styles.form} colon={false} form={form}>
					<Form.Item label={t("type")} name="type" className={styles.formItem}>
						<Radio.Group
							options={[
								{
									label: t("proxyServer"),
									value: PlatformPackage.ProxyServerType.ProxyServer,
								},
							]}
						/>
					</Form.Item>

					<Form.Item
						label={t("name")}
						name="name"
						required
						className={styles.formItem}
						rules={[{ required: true, message: "" }]}
					>
						<MagicInput
							maxLength={200}
							placeholder={
								type === PlatformPackage.ProxyServerType.ProxyServer
									? t("pleaseInputServerName")
									: t("pleaseInputSourceName")
							}
						/>
					</Form.Item>

					{type === PlatformPackage.ProxyServerType.ProxyServer ? (
						<>
							<Form.Item
								label={t("proxyProtocol")}
								name="protocol"
								required
								className={styles.formItem}
							>
								<MagicSelect options={protocolOptions} />
							</Form.Item>

							<Form.Item
								label={t("server")}
								name="host"
								required
								rules={[
									{ required: true, message: "" },
									{
										validator: (_, value) => validatorHost(value as string, t),
									},
								]}
								className={styles.formItem}
							>
								<MagicInput placeholder={t("pleaseInputServer")} />
							</Form.Item>

							<Form.Item
								label={t("port")}
								required
								name="port"
								rules={[
									{ required: true, message: "" },
									{
										validator: (_, value) => {
											if (value && !/^\d+$/.test(value)) {
												return Promise.reject(
													new Error(t("pleaseInputValidPort")),
												)
											}
											return Promise.resolve()
										},
									},
								]}
								className={styles.formItem}
							>
								<MagicInput placeholder={t("pleaseInputServerPort")} />
							</Form.Item>

							<Form.Item
								label={t("username")}
								name="username"
								className={styles.formItem}
							>
								<MagicInput placeholder={t("pleaseInputUsername")} />
							</Form.Item>

							<Form.Item
								label={t("password")}
								name="password"
								className={styles.formItem}
							>
								<MagicInput.Password placeholder={t("pleaseInputPassword")} />
							</Form.Item>
						</>
					) : (
						<>
							<Form.Item
								label={t("sourcePlatform")}
								name="platform"
								required
								className={styles.formItem}
							>
								<MagicSelect options={[]} />
							</Form.Item>

							<Form.Item
								label={t("requestInterface")}
								name="subscription_url"
								required
								className={styles.formItem}
							>
								<MagicInput placeholder={t("pleaseInputSourceRequestInterface")} />
							</Form.Item>

							<Form.Item
								label="API Key"
								name={["auth_config", "authKey"]}
								required
								className={styles.formItem}
							>
								<MagicInput placeholder={t("pleaseInputSourceAPIKey")} />
							</Form.Item>

							<Form.Item
								label={t("apiPassword")}
								name={["auth_config", "authPwd"]}
								required
								className={styles.formItem}
							>
								<MagicInput.Password placeholder={t("pleaseInputSourcePassword")} />
							</Form.Item>

							<Form.Item
								label={t("proxyDuration")}
								name="proxyDuration"
								required
								className={styles.formItem}
							>
								<Radio.Group options={proxyDurationOptions} />
							</Form.Item>

							<Form.Item
								label={t("proxyRegion")}
								name="proxyRegion"
								required
								className={styles.formItem}
							>
								<Radio.Group options={proxyRegionOptions} />
							</Form.Item>
						</>
					)}

					<Form.Item label={t("remark")} name="remark" className={styles.formItem}>
						<MagicInput.TextArea
							maxLength={500}
							rows={4}
							placeholder={t("pleaseInputRemark")}
						/>
					</Form.Item>
					{footer}
				</MagicForm>
			</MagicModal>
		)
	},
)
