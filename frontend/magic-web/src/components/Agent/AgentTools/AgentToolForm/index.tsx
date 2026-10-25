import { AgentCommonModalChildrenProps } from "@/components/Agent/AgentCommonModal"
import { IconX } from "@tabler/icons-react"
import { Button, Form, Input } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { FlowApi } from "@/apis"
import { useTranslation } from "react-i18next"
import { pick } from "lodash-es"
import type { Flow } from "@/types/flow"

export interface AgentToolFormProps extends AgentCommonModalChildrenProps {
	id?: string
	mcpId: string
	onFinish?: (info: Flow.Mcp.SaveParams) => void
	onSuccessCallback?: () => void
	/** Initial tool data passed directly when creating an MCP. */
	initialData?: Partial<Flow.Mcp.SaveParams>
}

const enum AgentToolFormField {
	Name = "name",
	Description = "description",
}

export default function AgentToolForm(props: AgentToolFormProps) {
	const { id, mcpId, onClose, onSuccessCallback, initialData } = props

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
			// Use the supplied initial data when creating an MCP.
			form.setFieldsValue(initialData)
		} else if (id && mcpId) {
			// Fetch tool details when editing a tool in an existing MCP.
			run(id, mcpId)
		}
	})

	const onFinish = useMemoizedFn((values) => {
		const fieldsName = ["id", "name", "description", "source", "rel_code", "enabled"]
		// Prefer initial data over the API response when both are available.
		const baseData = initialData || data || {}
		const formData = id ? { id, ...baseData, ...values } : { ...baseData, ...values }

		if (props?.onFinish) {
			// Delegate submission to the supplied callback, including when no MCP ID exists yet.
			props.onFinish(pick(formData, fieldsName))
			onClose?.()
		} else {
			// Save through the API when no submission callback is supplied.
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
		<div className="w-full overflow-hidden rounded-[12px]">
			<div className="flex w-full items-center justify-between gap-2.5 border-b border-border px-5 py-2.5 text-base font-semibold not-italic leading-[22px] text-foreground/80 backdrop-blur-[12px]">
				{t(isEdit ? "common.tool.editTitle" : "common.tool.createTitle")}
				<div
					className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] transition-all duration-100 ease-linear hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
					onClick={onClose}
				>
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
					{/* Preserve Ant Design label spacing and typography; Form still handles validation and submission. */}
					<div className="max-h-[60vh] w-full p-2.5 [&_.magic-form-item-label]:!pb-1.5 [&_.magic-form-item-label_label]:text-xs [&_.magic-form-item-label_label]:font-normal [&_.magic-form-item-label_label]:not-italic [&_.magic-form-item-label_label]:leading-4 [&_.magic-form-item-label_label]:text-foreground/60">
						<Form.Item
							name={AgentToolFormField.Name}
							label={t("common.tool.form.name")}
							required
							rules={[{ required: true }]}
							className="mb-2.5 last:mb-0"
						>
							<Input placeholder={t("common.tool.form.namePlaceholder")} />
						</Form.Item>
						<Form.Item
							name={AgentToolFormField.Description}
							label={t("common.tool.form.desc")}
							required
							rules={[{ required: true }]}
							className="mb-2.5 last:mb-0"
						>
							<Input placeholder={t("common.tool.form.descPlaceholder")} />
						</Form.Item>
					</div>
					<div className="flex justify-end gap-2.5 p-2.5">
						<Button
							className="dark:!border-border dark:!bg-fill dark:!text-foreground/80 dark:hover:!bg-fill-secondary"
							onClick={onClose}
						>
							{t("common.tool.form.cancel")}
						</Button>
						<Button
							className="dark:!bg-primary dark:!text-primary-foreground dark:hover:!bg-primary/90"
							htmlType="submit"
							type="primary"
						>
							{t(isEdit ? "common.tool.form.save" : "common.tool.form.create")}
						</Button>
					</div>
				</Form>
			</MagicSpin>
		</div>
	)
}
