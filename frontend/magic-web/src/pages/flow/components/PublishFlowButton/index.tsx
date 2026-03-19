import { Button, Form } from "antd"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import { useBoolean, useMemoizedFn, useUpdateEffect } from "ahooks"
import { useMemo, type MutableRefObject } from "react"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useFlowStore } from "@/stores/flow"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import antdStyles from "@/pages/flow/index.module.less"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import { FlowApi } from "@/apis"
import styles from "./index.module.less"
import { useCustomFlow } from "../../context/CustomFlowContext/useCustomFlow"
import { shadowFlow } from "../../utils/helpers"
import magicToast from "@/components/base/MagicToaster/utils"

type PublishFlowButtonProps = {
	flowInstance?: MutableRefObject<MagicFlowInstance | null>
	flow?: MagicFlow.Flow
	Icon?: any
	isMainFlow: boolean
	initPublishList?: (this: any, flowCode: any) => Promise<void>
}

export default function PublishFlowButton({
	flowInstance,
	flow,
	Icon,
	isMainFlow,
	initPublishList,
}: PublishFlowButtonProps) {
	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()
	const [form] = Form.useForm()

	const { setCurrentFlow } = useCustomFlow()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const { publishList } = useFlowStore()

	const publishFlow = useMemoizedFn(async (formValues: any) => {
		const latestFlow = flowInstance?.current?.getFlow()
		if (!latestFlow) return
		const shadowedFlow = shadowFlow(latestFlow)

		const flowId = latestFlow?.id ?? ""

		const requestParams = {
			name: formValues.name,
			description: formValues.description,
			magic_flow: {
				...shadowedFlow,
				// @ts-ignore
				global_variable: flow?.global_variable,
			},
		}
		const publishDetail = await FlowApi.publishFlow(requestParams, flowId)
		magicToast.success(globalT("common.savedSuccess", { ns: "flow" }))
		setFalse()
		// @ts-ignore
		setCurrentFlow({
			...latestFlow,
			version_code: publishDetail.id,
		})
		initPublishList?.(flowId)

		// 同时发送给当前窗口的监听器（用于Modal场景）
		console.log("PublishFlowButton: Sending FLOW_PUBLISHED message")
		window.postMessage(
			{
				type: "FLOW_PUBLISHED",
				data: {
					flowId,
					publishDetail,
				},
			},
			"*",
		)
	})

	const handleOk = useMemoizedFn(async () => {
		try {
			if (isMainFlow) {
				publishFlow({
					name: flow?.name,
					description: "",
				})
			} else {
				await form.validateFields()
				const values = form.getFieldsValue()
				publishFlow(values)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		setFalse()
	})

	const initialValues = useMemo(() => {
		return {
			name: `${flow?.name}_版本${publishList.length + 1}`,
			description: "",
		}
	}, [publishList.length, flow?.name])

	useUpdateEffect(() => {
		form.setFieldsValue({
			name: `${flow?.name}_版本${publishList.length + 1}`,
		})
	}, [publishList.length, flow])

	return (
		<>
			{!Icon && (
				<Button
					type="primary"
					onClick={isMainFlow ? handleOk : setTrue}
					className={styles.btn}
				>
					{t("button.publish")}
				</Button>
			)}
			{Icon && <Icon onClick={isMainFlow ? handleOk : setTrue} />}

			<MagicModal
				className={antdStyles.antdModal}
				title="填写版本信息"
				open={open}
				onOk={handleOk}
				onCancel={handleCancel}
			>
				<Form form={form} className={styles.form} initialValues={initialValues}>
					<Form.Item name="name" label="版本名称">
						<MagicInput />
					</Form.Item>
					<Form.Item name="description" label="版本描述">
						<MagicInput.TextArea />
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}
