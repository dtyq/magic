import MagicButton from "@/opensource/components/base/MagicButton"
import MagicModal from "@/opensource/components/base/MagicModal"
import { generateSnowFlake } from "@/opensource/pages/flow/utils/helpers"
import type { Conversation } from "@/types/chat/conversation"
import { Flow, type ApiKey, type ApiKeyRequestParams, type NewKeyForm } from "@/types/flow"
import { useBoolean, useMemoizedFn, useUpdateEffect } from "ahooks"
import { FlowApi } from "@/apis"
import { Form, Input, message } from "antd"
import { useForm } from "antd/es/form/Form"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type NewKeyButtonProps = {
	detail?: ApiKey
	conversation: Partial<Conversation> & Pick<Conversation, "id">
	onListItemChanged: (detail: ApiKey, type: "edit" | "create") => void
	IconComponent?: React.FC<{
		onClick: () => void
	}>
	flowId: string
	isMcp: boolean
}

export default function NewKeyButton({
	detail,
	onListItemChanged,
	conversation,
	IconComponent,
	flowId,
	isMcp,
}: NewKeyButtonProps) {
	const { t } = useTranslation("interface")

	const [form] = useForm<NewKeyForm>()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const [defaultConversation, setDefaultConversation] = useState({
		id: generateSnowFlake(),
	} as Partial<Conversation> & Pick<Conversation, "id">)

	const curConversation = useMemo(() => {
		return conversation ?? defaultConversation
	}, [conversation, defaultConversation])

	useUpdateEffect(() => {
		setDefaultConversation({ id: generateSnowFlake() })
	}, [open])

	const initialValues = useMemo(() => {
		return {
			name: detail?.name,
			description: detail?.description,
		}
	}, [detail?.name, detail?.description])

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()
			try {
				const params = { ...res } as ApiKeyRequestParams
				if (detail) {
					params.id = detail.id
					params.conversation_id = detail.conversation_id
				}
				const data = isMcp
					? await FlowApi.saveApiKeyV1({
							...res,
							id: detail?.id ?? "",
							rel_type: Flow.ApiKeyType.Mcp,
							rel_code: flowId,
					  })
					: await FlowApi.saveApiKey(
							{
								// @ts-ignore
								conversation_id: curConversation.id,
								...params,
							},
							flowId,
					  )
				const labelPrefix = detail ? t("flow.apiKey.addKey") : t("flow.apiKey.editKey")
				message.success(`${labelPrefix} ${res.name} ${t("flow.apiKey.success")}`)
				onListItemChanged(data, detail ? "edit" : "create")
				setFalse()
			} catch (err: any) {
				if (err.message) console.error(err.message)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	return (
		<>
			{IconComponent ? (
				<IconComponent onClick={setTrue} />
			) : (
				<MagicButton justify="flex-start" type="primary" onClick={setTrue}>
					{t("flow.apiKey.addKey")}
				</MagicButton>
			)}

			<MagicModal
				title={t("flow.apiKey.addKey")}
				open={open}
				closable
				okText={t("button.confirm", { ns: "interface" })}
				cancelText={t("button.cancel", { ns: "interface" })}
				centered
				onCancel={setFalse}
				onOk={handleOk}
			>
				<Form
					form={form}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					initialValues={initialValues}
					labelCol={{ span: 4 }}
				>
					<Form.Item
						name="name"
						label={t("flow.apiKey.name")}
						required
						rules={[{ required: true }]}
					>
						<Input placeholder={t("flow.apiKey.namePlaceholder")} />
					</Form.Item>
					<Form.Item name="description" label={t("flow.apiKey.description")}>
						<Input.TextArea placeholder={t("flow.apiKey.descPlaceholder")} />
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}
