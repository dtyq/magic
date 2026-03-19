import { useStyles } from "./styles"
import { Flex, Button, Form, Input } from "antd"
import { IconX } from "@tabler/icons-react"
import { IconMCP } from "@/enhance/tabler/icons-react"
import MagicScrollBar from "@/components/base/MagicScrollBar"
import MagicSpin from "@/components/base/MagicSpin"
import { useRef, useState } from "react"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import { useMemoizedFn, useRequest, useThrottleEffect } from "ahooks"
import { FlowApi } from "@/apis"
import { MCPOAuthService } from "../service/MCPOAuthService"
import { generateCallbackUrl } from "../helpers"
import { trim, isString } from "lodash-es"
import MagicImage from "@/components/base/MagicImage"
import { useTranslation } from "react-i18next"

interface MCPEditor extends AgentCommonModalChildrenProps {
	id: string
	onEnable?: ((id: string) => Promise<void>) | ((id: string) => void)
}

export default function MCPOAuth(props: MCPEditor) {
	const { id, onClose, onEnable } = props
	const { styles, cx } = useStyles()

	const [form] = Form.useForm()
	const { t } = useTranslation("agent")
	const service = useRef<MCPOAuthService>(new MCPOAuthService(FlowApi))

	/** 是否填写完表单，触发轮询 */
	const [isAuth, setAuth] = useState(false)
	const [authVisible, setAuthVisible] = useState(false)
	const [isFinishFillForm, setFinishFillForm] = useState(false)

	const {
		data,
		loading: getMCPUserSettingsLoading,
		refresh,
	} = useRequest(
		() => FlowApi.getMCPUserSettings({ code: id, redirectUrl: generateCallbackUrl() }),
		{
			onSuccess(data) {
				setAuth(data?.auth_config?.is_authenticated)
				setAuthVisible(data?.auth_type === 1)
			},
		},
	)

	const { data: mcpDetails, loading: getAvailableMCPLoading } = useRequest(() =>
		FlowApi.getAvailableMCP([id]),
	)

	useThrottleEffect(
		() => {
			const details = mcpDetails?.list?.[0]
			if (details && data) {
				// 当且仅当存在表单项需要填写时才触发流程
				if (details.require_fields.length === 0) {
					setFinishFillForm(true)
				} else {
					const fieldNames = details.require_fields.map((i) => i.field_name)

					const formData = data.require_fields.reduce<Record<string, any>>(
						(res, item) => {
							res[item.field_name] = item.field_value
							return res
						},
						{},
					)
					form.setFieldsValue(formData)
					setFinishFillForm(
						fieldNames.every(
							(i) => isString(formData?.[i]) && trim(formData?.[i]) !== "",
						),
					)
				}
			}
		},
		[mcpDetails, data],
		{ wait: 500, leading: false },
	)

	const onSubmit = useMemoizedFn(async () => {
		const values = form.getFieldsValue()
		const formData = Object.keys(values).map((key) => ({
			field_name: key,
			field_value: values?.[key],
		}))
		if (formData.length > 0) {
			await FlowApi.saveMCPRequireFields(id, {
				require_fields: formData,
			})
		}
		// // 启用当前 MCP
		onEnable?.(id)
		onClose?.()
	})

	const triggerStartPolling = useMemoizedFn(() => {
		if (data?.auth_config?.oauth_url) {
			window.open(data?.auth_config?.oauth_url)
			// 这里需要通过新窗口打开授权页面，指定授权成功回调页面
			service.current?.restart(id)
		}
	})

	const triggerUnbind = useMemoizedFn(async () => {
		await FlowApi.unBindMCPOAuth(id)
		setAuth(false)
		refresh()
	})

	/** 表单填写 */
	const onValuesChange = useMemoizedFn((_changedValues, values) => {
		// 检查表单是否都填写完成
		if (mcpDetails?.list?.[0]?.require_fields) {
			const result = mcpDetails?.list?.[0]?.require_fields.every((fieldItem) => {
				const fieldValue = values?.[fieldItem?.field_name]
				return isString(fieldValue) && trim(fieldValue) !== ""
			})
			setFinishFillForm(result)
		}
	})

	useThrottleEffect(
		() => {
			service.current?.setCallbacks({
				// 授权成功回调
				onSuccess() {
					setAuth(true)
				},
			})

			const currentService = service.current
			return () => {
				currentService?.destroy?.()
			}
		},
		[],
		{ wait: 500, leading: false },
	)

	const mcpInfo = mcpDetails?.list?.[0]
	return (
		<div className={styles.layout}>
			<div className={styles.header}>
				<Flex gap={10} align="center">
					<div className={styles.icon}>
						<MagicImage
							className={styles.icon}
							src={mcpInfo?.icon}
							alt={mcpInfo?.name}
							fallback={
								<div className={styles.icon}>
									<IconMCP size="100%" />
								</div>
							}
						/>
					</div>
					<Flex vertical>
						<span className={styles.title}>{mcpInfo?.name}</span>
						<span className={styles.desc}>
							{mcpInfo?.description || t("mcp.card.desc")}
						</span>
					</Flex>
				</Flex>
				<div className={styles.close} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>
			<MagicSpin spinning={getMCPUserSettingsLoading || getAvailableMCPLoading}>
				<Flex className={styles.body} vertical gap={20}>
					<div className={styles.loading}>
						<MagicScrollBar className={styles.wrapper} autoHide={false}>
							<Form form={form} layout="vertical" onValuesChange={onValuesChange}>
								{mcpDetails &&
									mcpDetails?.list?.[0]?.require_fields?.length > 0 && (
										<>
											{mcpDetails?.list?.[0]?.require_fields?.map((item) => (
												<Form.Item
													key={item.field_name}
													label={item.field_name}
													name={item.field_name}
													className={styles.item}
													required
													rules={[
														{
															required: true,
															message: t("mcp.form.required", {
																name: item.field_name,
															}),
														},
													]}
												>
													<Input />
												</Form.Item>
											))}
										</>
									)}
								{authVisible && (
									<Form.Item label={t("mcp.form.auth")} className={styles.item}>
										{isAuth ? (
											<div
												onClick={triggerUnbind}
												className={cx(styles.section)}
											>
												{t("mcp.form.authToSuccess")}
											</div>
										) : (
											<div
												onClick={triggerStartPolling}
												className={cx(styles.section, {
													[styles.active]: !isAuth,
												})}
											>
												{t("mcp.form.authToFail")}
											</div>
										)}
									</Form.Item>
								)}
							</Form>
						</MagicScrollBar>
					</div>
					<Flex className={styles.menu} justify="flex-end" align="center" gap={10}>
						<Button onClick={onClose}>{t("mcp.form.cancel")}</Button>
						<Button
							type="primary"
							onClick={onSubmit}
							disabled={!(isFinishFillForm && (authVisible ? isAuth : true))}
						>
							{t("mcp.form.confirm")}
						</Button>
					</Flex>
				</Flex>
			</MagicSpin>
		</div>
	)
}
