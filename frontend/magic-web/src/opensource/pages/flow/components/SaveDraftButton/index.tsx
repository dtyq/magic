import { Button, Form } from "antd"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useMemo, type MutableRefObject } from "react"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { FlowDraft } from "@/opensource/types/flow"
import antdStyles from "@/opensource/pages/flow/index.module.less"
import { useTranslation } from "react-i18next"
import MagicModal from "@/opensource/components/base/MagicModal"
import { FlowApi } from "@/opensource/apis"
import styles from "./index.module.less"
import { getCurrentDateTimeString, shadowFlow } from "../../utils/helpers"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

type SaveDraftButtonProps = {
	flowInstance?: MutableRefObject<MagicFlowInstance | null>
	flow?: MagicFlow.Flow
	draft?: FlowDraft.ListItem
	Icon?: any
	initDraftList?: (this: any, flowCode: any) => Promise<FlowDraft.Detail[]>
}

export default function SaveDraftButton({
	flowInstance,
	flow,
	draft,
	Icon,
	initDraftList,
}: SaveDraftButtonProps) {
	const { t } = useTranslation()
	const [form] = Form.useForm()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const saveDraft = useMemoizedFn(async (formValues: any) => {
		const latestFlow = flowInstance?.current?.getFlow()
		const shadowedFlow = shadowFlow(latestFlow!)
		if (!latestFlow) return

		const flowId = (shadowedFlow.code || latestFlow?.id) ?? ""

		const requestParams = draft
			? {
					id: draft?.id,
					name: formValues.name,
					description: formValues.description,
				}
			: {
					name: formValues.name,
					description: formValues.description,
					magic_flow: {
						...shadowedFlow,
						// @ts-ignore
						global_variable: flow?.global_variable,
					},
				}
		await FlowApi.saveFlowDraft(requestParams, flowId)
		magicToast.success(
			draft?.id
				? t("common.updateDraftSuccess", { ns: "flow" })
				: t("common.saveDraftSuccess", { ns: "flow" }),
		)
		setFalse()
		initDraftList?.(flowId)
	})

	const handleOk = useMemoizedFn(async () => {
		try {
			await form.validateFields()
			const values = form.getFieldsValue()
			saveDraft(values)
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		setFalse()
	})

	const initialValues = useMemo(() => {
		if (draft) {
			return {
				name: draft.name,
				description: draft.description,
			}
		}
		return {
			name: `${flow?.name}_${t("common.draft", { ns: "flow" })}${getCurrentDateTimeString()}`,
			description: "",
		}
	}, [draft, flow?.name, t])

	return (
		<>
			{!Icon && (
				<Button onClick={setTrue} className={styles.btn}>
					{t("common.saveDraft", { ns: "flow" })}
				</Button>
			)}
			{Icon && <Icon onClick={setTrue} />}

			<MagicModal
				className={antdStyles.antdModal}
				title={t("common.draftModalTitle", { ns: "flow" })}
				open={open}
				onOk={handleOk}
				onCancel={handleCancel}
			>
				<Form form={form} className={styles.form} initialValues={initialValues}>
					<Form.Item name="name" label={t("common.draftName", { ns: "flow" })}>
						<MagicInput />
					</Form.Item>
					<Form.Item name="description" label={t("common.draftDesc", { ns: "flow" })}>
						<MagicInput.TextArea />
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}
