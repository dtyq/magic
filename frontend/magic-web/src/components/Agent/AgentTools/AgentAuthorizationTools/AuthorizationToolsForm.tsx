import { createStyles } from "antd-style"
import magicToast from "@/components/base/MagicToaster/utils"
import { IconX } from "@tabler/icons-react"
import { Form, Input, Flex, Button, InputNumber } from "antd"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import { useRequest, useThrottleEffect, useThrottleFn } from "ahooks"
import MagicSpin from "@/components/base/MagicSpin"
import { FlowApi } from "@/apis"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, token }) => ({
	layout: css`
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
	`,
	header: css`
		width: 100%;
		display: flex;
		padding: 10px 20px;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid ${token.magicColorUsages.border};
		backdrop-filter: blur(12px);
		color: ${token.magicColorUsages.text[1]};
		font-size: 16px;
		font-style: normal;
		font-weight: 600;
		line-height: 22px; /* 137.5% */
	`,
	close: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all linear 0.1s;
		border-radius: 6px;

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}

		&:active {
			background-color: ${token.magicColorUsages.fill[1]};
		}
	`,
	body: css`
		width: 80%;
		margin: 0 auto;
		padding: 10px;
		max-height: 60vh;
		display: flex;
		flex-direction: column;
		gap: 10px;
	`,
}))

interface AuthorizationToolsForm extends AgentCommonModalChildrenProps {
	id?: string
	/** 工具所归属的 MCP */
	mcpCode?: string
	onSuccessCallback?: () => void
}

export default function AuthorizationToolsForm(props: AuthorizationToolsForm) {
	const { id, mcpCode, onClose, onSuccessCallback } = props
	const { styles } = useStyles()
	const { t } = useTranslation("agent")

	const [form] = Form.useForm()

	const { run, loading } = useRequest((id: string) => FlowApi.getApiKeyDetailV1(id), {
		manual: true,
		onSuccess(data) {
			form.setFieldsValue(data)
		},
	})

	const { run: onSubmit } = useThrottleFn(
		async (values) => {
			const formData = id
				? { id, ...values, rel_code: mcpCode }
				: { ...values, rel_code: mcpCode }
			await FlowApi.saveApiKeyV1(formData)
			magicToast.success(t(id ? "common.auth.editToSuccess" : "common.auth.createToSuccess"))
			onSuccessCallback?.()
			onClose?.()
		},
		{ wait: 1000, trailing: false },
	)

	useThrottleEffect(
		() => {
			if (id) {
				run(id)
			}
		},
		[id],
		{ wait: 500, leading: true, trailing: false },
	)

	return (
		<MagicSpin spinning={loading}>
			<div className={styles.layout}>
				<div className={styles.header}>
					{t(id ? "common.auth.editTitle" : "common.auth.createTitle")}
					<div className={styles.close} onClick={onClose}>
						<IconX size={24} />
					</div>
				</div>
				<div className={styles.body}>
					<Form layout="vertical" form={form} onFinish={onSubmit}>
						<Form.Item hidden name="rel_type" initialValue={2}>
							<InputNumber />
						</Form.Item>
						<Form.Item hidden name="rel_code">
							<Input />
						</Form.Item>
						<Form.Item
							name="name"
							label={t("common.tool.name")}
							required
							rules={[{ required: true }]}
						>
							<Input />
						</Form.Item>
						<Form.Item name="description" label={t("common.tool.desc")}>
							<Input.TextArea />
						</Form.Item>
						<Flex align="center" justify="flex-end" gap={10}>
							<Button onClick={onClose}>{t("common.tool.cancel")}</Button>
							<Button type="primary" htmlType="submit">
								{t("common.tool.confirm")}
							</Button>
						</Flex>
					</Form>
				</div>
			</div>
		</MagicSpin>
	)
}
