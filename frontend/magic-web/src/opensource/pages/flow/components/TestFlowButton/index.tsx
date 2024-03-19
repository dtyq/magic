import { useTranslation } from "react-i18next"
import { Form, Input, Button, DatePicker, Switch } from "antd"
import { useBoolean, useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import { useForm } from "antd/es/form/Form"
import type { MutableRefObject } from "react"
import { useEffect, useMemo } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { TriggerConfig } from "@/opensource/types/flow"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import dayjs from "@/opensource/lib/dayjs"
import { nanoid } from "nanoid"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import antdStyles from "@/opensource/pages/flow/index.module.less"
import MagicModal from "@/opensource/components/base/MagicModal"
import { useUserInfo } from "@/opensource/models/user/hooks"
import styles from "./index.module.less"
import { TriggerType, TriggerTypeOptions } from "../../nodes/Start/v0/constants"
import { MessageType } from "../../nodes/Reply/v0/constants"
import { getDefaultTestArgs } from "./helpers"
import useArguments from "./hooks/useArguments"
import { getComponent } from "../../utils/helpers"
// import useConversations from "./useConversations"

type TestFlowForm = TriggerConfig

type TestFlowProps = {
	onFinished: (triggerConfig: TriggerConfig, closeModal: () => void) => void
	loading: boolean
	flow?: MagicFlow.Flow
	flowInstance: MutableRefObject<MagicFlowInstance | null>
}

function TestFlowButton({ onFinished, loading, flow, flowInstance }: TestFlowProps) {
	const { t } = useTranslation()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const [formValues, setFormValues] = useResetState({} as unknown as Partial<TriggerConfig>)

	const { userInfo: data } = useUserInfo()

	const [form] = useForm<TestFlowForm>()

	useUpdateEffect(() => {
		const formHasValue = Object.keys(formValues).length > 0
		if (open && data && !formHasValue) {
			const defaultTestArgs = getDefaultTestArgs(TriggerType.Message, data)
			// @ts-ignore
			form.setFieldsValue({
				...defaultTestArgs,
			})
			// @ts-ignore
			setFormValues({
				...defaultTestArgs,
			})
		}
	}, [open, data, formValues])

	const handleOk = useMemoizedFn(async () => {
		try {
			await form.validateFields()
			const values = form.getFieldsValue()
			if (values?.trigger_data?.chat_time) {
				values.trigger_data.chat_time = dayjs(values?.trigger_data?.chat_time).format(
					"YYYY-MM-DD HH:mm:ss",
				)
			}
			if (values?.trigger_data?.open_time) {
				values.trigger_data.open_time = dayjs(values?.trigger_data?.open_time).format(
					"YYYY-MM-DD HH:mm:ss",
				)
			}
			// console.log("values", values)
			onFinished(values, setFalse)
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		setFalse()
	})

	const messageTypeOptions = useMemo(() => {
		return [
			{
				label: t("common.text", { ns: "flow" }),
				value: MessageType.Text,
			},
		]
	}, [t])

	const onValuesChange = useMemoizedFn((changeValues) => {
		// Deep merge trigger_data, especially for files array
		const mergedTriggerData = {
			...formValues.trigger_data,
			...changeValues.trigger_data,
		}

		// Special handling for files array - merge array items deeply
		if (changeValues.trigger_data?.files && formValues.trigger_data?.files) {
			// Use Array.from to ensure it's a real array and iterate over ALL elements
			const changeFilesArray = Array.from(changeValues.trigger_data.files)
			const formFilesArray = Array.from(formValues.trigger_data.files)

			// @ts-ignore - files field exists at runtime
			mergedTriggerData.files = changeFilesArray.map((changedFile: any, index: number) => {
				// @ts-ignore - files field exists at runtime
				const originalFile = formFilesArray[index]

				// If changedFile is null/undefined, keep the original value
				if (changedFile == null) {
					return originalFile || {}
				}

				// Otherwise, merge the changed fields with original fields
				return {
					...originalFile,
					...changedFile,
				}
			})
		}

		const updatedValues = {
			...formValues,
			...changeValues,
			trigger_data: mergedTriggerData,
		}

		// Set the merged values to form instead of changeValues
		form.setFieldsValue(updatedValues)
		setFormValues(updatedValues)
	})

	// 工具的动态入参
	const { isArgumentsFlow, dynamicFormItems } = useArguments({
		open,
		form,
		flow,
		onValuesChange,
		flowInstance,
	})

	useEffect(() => {
		if (formValues?.trigger_type === TriggerType.Message) {
			form.setFieldsValue({
				conversation_id: nanoid(8),
				trigger_data: {
					nickname: data?.nickname,
					message_type: MessageType.Text,
					content: "",
					chat_time: dayjs(),
				},
			})
		}
		if (formValues?.trigger_type === TriggerType.NewChat) {
			form.setFieldsValue({
				trigger_data: {
					nickname: data?.nickname,
					open_time: dayjs(),
				},
			})
		}
		if (formValues?.trigger_type === TriggerType.Arguments) {
			form.setFieldsValue({
				trigger_type: TriggerType.Arguments,
			})
			return
		}

		setFormValues(form.getFieldsValue())
	}, [data?.nickname, form, formValues?.trigger_type, setFormValues])

	return (
		<>
			<Button
				// icon={<TestNodeBtn />}
				type="text"
				loading={loading}
				onClick={setTrue}
				className={styles.btn}
			>
				{t("common.testFlow", { ns: "flow" })}
			</Button>
			<MagicModal
				title={t("common.fillContent", { ns: "flow" })}
				open={open}
				onOk={handleOk}
				onCancel={handleCancel}
				closable
				okText={t("button.confirm", { ns: "interface" })}
				cancelText={t("button.cancel", { ns: "interface" })}
				centered
				confirmLoading={loading}
				className={antdStyles.antdModal}
			>
				<Form
					form={form}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					onValuesChange={onValuesChange}
					className={styles.testFlowForm}
				>
					<Form.Item
						name="trigger_type"
						label={t("common.triggerType", { ns: "flow" })}
						required
						rules={[{ required: true }]}
						normalize={(value) => Number(value)}
						style={{ display: isArgumentsFlow ? "none" : "block" }}
						className="form-item"
					>
						<MagicSelect
							options={TriggerTypeOptions}
							className={styles.triggerTypeSelect}
							placeholder={t("common.pleaseSelect", { ns: "flow" })}
						/>
					</Form.Item>
					{!isArgumentsFlow && (
						<Form.Item
							name="conversation_id"
							label={t("common.conversationId", { ns: "flow" })}
							extra={t("common.conversationIdDesc", { ns: "flow" })}
							required
							className="form-item"
						>
							<MagicInput placeholder={t("common.pleaseInput", { ns: "flow" })} />
						</Form.Item>
					)}
					{!isArgumentsFlow && (
						<Form.Item name="trigger_data">
							{formValues?.trigger_type && (
								<Form.Item
									name={["trigger_data", "nickname"]}
									label={t("common.username", { ns: "flow" })}
									required
									className="form-item"
								>
									<MagicInput
										placeholder={t("common.usernamePlaceholder", {
											ns: "flow",
										})}
									/>
								</Form.Item>
							)}
							{formValues?.trigger_type === TriggerType.Message && (
								<>
									<Form.Item
										name={["trigger_data", "chat_time"]}
										label={t("common.sendTime", { ns: "flow" })}
										required
										className="form-item"
									>
										<DatePicker
											format="YYYY-MM-DD HH:mm:ss"
											showTime
											placeholder={t("common.sendTimePlaceholder", {
												ns: "flow",
											})}
										/>
									</Form.Item>
									<Form.Item
										name={["trigger_data", "message_type"]}
										label={t("common.messageType", { ns: "flow" })}
										required
										className="form-item"
									>
										<MagicSelect
											options={messageTypeOptions}
											placeholder={t("common.messageTypePlaceholder", {
												ns: "flow",
											})}
										/>
									</Form.Item>
									<Form.Item
										name={["trigger_data", "content"]}
										label={t("common.messageContent", { ns: "flow" })}
										required
										className="form-item"
										rules={[{ required: true }]}
									>
										<Input.TextArea
											placeholder={t("common.messageContentPlaceholder", {
												ns: "flow",
											})}
										/>
									</Form.Item>
									<Form.Item
										label={t("common.attachedFiles", { ns: "flow" })}
										className="form-item"
									>
										<Form.List name={["trigger_data", "files"]}>
											{(fields, { add, remove }) => (
												<>
													{fields.map((field) => (
														<div
															key={field.key}
															style={{
																display: "flex",
																gap: 8,
																marginBottom: 8,
															}}
														>
															<Form.Item
																{...field}
																name={[field.name, "name"]}
																style={{ flex: 1, marginBottom: 0 }}
																rules={[
																	{
																		required: true,
																		message: t(
																			"common.fileNameRequired",
																			{
																				ns: "flow",
																			},
																		),
																	},
																]}
															>
																<MagicInput placeholder="文件名" />
															</Form.Item>
															<Form.Item
																{...field}
																name={[field.name, "url"]}
																style={{ flex: 2, marginBottom: 0 }}
																rules={[
																	{
																		required: true,
																		message: t(
																			"common.fileUrlRequired",
																			{
																				ns: "flow",
																			},
																		),
																	},
																	{
																		type: "url",
																		message: t(
																			"form.urlInvalid",
																			{ ns: "interface" },
																		),
																	},
																]}
															>
																<MagicInput placeholder="文件地址" />
															</Form.Item>
															<Button
																type="text"
																icon={<Trash2 size={16} />}
																onClick={() => remove(field.name)}
																danger
															/>
														</div>
													))}
													<Button
														type="dashed"
														onClick={() => add()}
														block
														icon={<Plus size={16} />}
													>
														{t("common.addFile", { ns: "flow" })}
													</Button>
												</>
											)}
										</Form.List>
									</Form.Item>
								</>
							)}

							{formValues?.trigger_type === TriggerType.NewChat && (
								<Form.Item
									name={["trigger_data", "open_time"]}
									label={t("common.openTime", { ns: "flow" })}
									required
									className="form-item"
								>
									<DatePicker
										format="YYYY-MM-DD HH:mm:ss"
										showTime
										placeholder={t("common.openTimePlaceholder", {
											ns: "flow",
										})}
									/>
								</Form.Item>
							)}
						</Form.Item>
					)}
					{isArgumentsFlow && (
						<>
							{dynamicFormItems.map((field) => {
								return (
									<Form.Item
										name={["trigger_data", field.key]}
										label={field.label}
										required={field.required}
										rules={[{ required: field.required }]}
										key={field.key}
										className="form-item"
									>
										{getComponent(field.type as FormItemType)}
									</Form.Item>
								)
							})}
						</>
					)}
					<Form.Item name={["debug"]} label="debug" className="form-item">
						<Switch />
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}

export default TestFlowButton
