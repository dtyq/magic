import { useStyles } from "./styles"
import { AgentCommonModalChildrenProps } from "@/opensource/components/Agent/AgentCommonModal"
import { IconX } from "@tabler/icons-react"
import { Button, Flex, Form, Input } from "antd"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { FlowApi } from "@/opensource/apis"
import { useTranslation } from "react-i18next"
import { pick } from "lodash-es"
import type { Flow } from "@/opensource/types/flow"

export interface AgentToolFormProps extends AgentCommonModalChildrenProps {
	id?: string
	mcpId: string
	onFinish?: (info: Flow.Mcp.SaveParams) => void
	onSuccessCallback?: () => void
	/** 初始数据，用于新建MCP时直接传递工具数据 */
	initialData?: Partial<Flow.Mcp.SaveParams>
}

const enum AgentToolFormField {
	Name = "name",
	Description = "description",
}

export default function AgentToolForm(props: AgentToolFormProps) {
	const { id, mcpId, onClose, onSuccessCallback, initialData } = props

	const { styles } = useStyles()
	const { t } = useTranslation("agent")

	const [form] = Form.useForm()

	const { run, loading, data } = useRequest(FlowApi.getMcpToolDetail, {
		manual: true,
		onSuccess(data) {
			form.setFieldsValue(data)
		},
	})

	const { runAsync: saveMCPTool, loading: saveMcpLoading } = useRequest(FlowApi.saveMcpTool, {
		manual: true,
	})

	useMount(() => {
		if (initialData) {
			// 如果提供了初始数据，直接使用（适用于新建MCP的情况）
			form.setFieldsValue(initialData)
		} else if (id && mcpId) {
			// 如果有id和mcpId，从API获取数据（适用于已有MCP的情况）
			run(id, mcpId)
		}
	})

	const onFinish = useMemoizedFn((values) => {
		const fieldsName = ["id", "name", "description", "source", "rel_code", "enabled"]
		// 如果有初始数据，优先使用初始数据；否则使用API返回的data
		const baseData = initialData || data || {}
		const formData = id ? { id, ...baseData, ...values } : { ...baseData, ...values }

		if (props?.onFinish) {
			// 当传递了onFinish回调时，使用回调处理（适用于没有mcpId的情况）
			props.onFinish(pick(formData, fieldsName))
			onClose?.()
		} else {
			// 当没有传递onFinish回调且有mcpId时，直接调用API
			if (!mcpId) {
				console.warn("mcpId is required for direct API call")
				return
			}
			saveMCPTool(pick(formData, fieldsName), mcpId)
				.then(() => {
					onSuccessCallback?.()
					onClose?.()
				})
				.catch(console.error)
		}
	})

	const isEdit = id || !!initialData

	return (
		<div className={styles.layout}>
			<div className={styles.header}>
				{t(isEdit ? "common.tool.editTitle" : "common.tool.createTitle")}
				<div className={styles.close} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>

			<MagicSpin spinning={loading || saveMcpLoading}>
				<Form
					form={form}
					colon={false}
					validateMessages={{ required: t("common.tool.form.required") }}
					layout="vertical"
					preserve={false}
					onFinish={onFinish}
				>
					<div className={styles.body}>
						<Form.Item
							name={AgentToolFormField.Name}
							label={t("common.tool.form.name")}
							required
							rules={[{ required: true }]}
							className={styles.formItem}
						>
							<Input placeholder={t("common.tool.form.namePlaceholder")} />
						</Form.Item>
						<Form.Item
							name={AgentToolFormField.Description}
							label={t("common.tool.form.desc")}
							required
							rules={[{ required: true }]}
							className={styles.formItem}
						>
							<Input placeholder={t("common.tool.form.descPlaceholder")} />
						</Form.Item>
					</div>
					<Flex justify="flex-end" gap={10} className={styles.footer}>
						<Button onClick={onClose}>{t("common.tool.form.cancel")}</Button>
						<Button htmlType="submit" type="primary">
							{t(isEdit ? "common.tool.form.save" : "common.tool.form.create")}
						</Button>
					</Flex>
				</Form>
			</MagicSpin>
		</div>
	)
}
