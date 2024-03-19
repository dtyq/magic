import { useTranslation } from "react-i18next"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import type { FormInstance } from "antd"
import type { DefaultOptionType } from "antd/es/select"
import { Flex, Form, Input, Select } from "antd"
import { useMemoizedFn } from "ahooks"
import IconCheckTick from "@/opensource/enhance/tabler/icons-react/icons/IconCheckTick"
import type {
	QuickInstruction,
	InstructionExplanation,
	InstructionValue,
	CommonQuickInstruction,
} from "@/opensource/types/bot"
import { InstructionMode as InstructionModeType, InstructionType } from "@/opensource/types/bot"
import type { MagicRichEditorRef } from "@/opensource/components/base/MagicRichEditor"
import type { UseEditorOptions } from "@tiptap/react"
import { genTemplateInstructionNode } from "@/opensource/pages/chatNew/components/quick-instruction/extension/utils"
import { QuickInstructionNodeTemplateExtension } from "@/opensource/pages/chatNew/components/quick-instruction/extension"
import { pickContent, combindContent } from "../../utils"
import SwitchOption from "../SwitchOption"
import SingleChoice from "../SingleChoice"
import { useStyles } from "../../styles"
import { ToolTipButton } from "../ToolTipButton"
import StatusButton from "../StatusButton"
import { InstructionContent } from "../InstructionContent"
import { SendCommand } from "../SendCommand"
import { InstructionResidency } from "../InstructionResidency"
import { InsertLocation } from "../InsertLocation"
import { InstructionMode } from "../InstructionMode"

interface InstructionListProps {
	edit: boolean
	form: FormInstance<QuickInstruction & { switch_on: boolean; switch_off: boolean }>
	options: DefaultOptionType[]
	selectedValue: InstructionType
	currentInstruction: CommonQuickInstruction | undefined
	setSelectedValue: React.Dispatch<React.SetStateAction<InstructionType>>
	onFinish: (val: QuickInstruction & { switch_on: boolean; switch_off: boolean }) => void
}

// 使用指令模型的指令类型
const useInstructionModel = [InstructionType.SINGLE_CHOICE, InstructionType.SWITCH]
// 使用直接发送指令的指令类型
const useSendCommand = [InstructionType.SINGLE_CHOICE, InstructionType.TEXT]
// 使用指令常驻的指令类型
const useInstructionResidency = [InstructionType.SINGLE_CHOICE, InstructionType.SWITCH]

const InstructionForm = memo(
	({
		form,
		edit,
		selectedValue,
		options,
		currentInstruction,
		setSelectedValue,
		onFinish,
	}: InstructionListProps) => {
		const { t } = useTranslation("interface")
		const { styles } = useStyles()

		const editorRef = useRef<MagicRichEditorRef>(null)
		const [fieldValues, setFieldValues] = useState<InstructionValue[]>([])
		const [currentInstructionExp, setCurrentInstructionExp] = useState<InstructionExplanation>()
		const [showInsertLocation, setShowInsertLocation] = useState(true)
		const [showSendCommand, setShowSendCommand] = useState(true)
		const [instructionMode, setInstructionMode] = useState<InstructionModeType>(
			InstructionModeType.Chat,
		)

		const isChatMode = useMemo(
			() => instructionMode === InstructionModeType.Chat,
			[instructionMode],
		)

		/** 统一处理插入位置显示逻辑 */
		const updateInsertLocationVisibility = useMemoizedFn(
			(
				isResidency: boolean = false,
				isSendDirectly: boolean = false,
				mode: InstructionModeType = InstructionModeType.Chat,
			) => {
				const isFlowMode = mode === InstructionModeType.Flow

				// 以下情况需要隐藏插入位置：
				// 1. 流程模式
				// 2. 指令常驻开启
				// 3. 直接发送指令开启
				if (isFlowMode || isResidency || isSendDirectly) {
					setShowInsertLocation(false)
					return
				}

				// 其他情况显示插入位置
				setShowInsertLocation(true)
			},
		)

		const updateSendCommandVisibility = useMemoizedFn(
			(
				isResidency: boolean = false,
				mode: InstructionModeType = InstructionModeType.Chat,
			) => {
				const isFlowMode = mode === InstructionModeType.Flow

				if (isFlowMode || isResidency) {
					setShowSendCommand(false)
					return
				}

				setShowSendCommand(true)
			},
		)

		useEffect(() => {
			if (edit && currentInstruction) {
				form.setFieldsValue(currentInstruction)
				if (currentInstruction.type === InstructionType.SWITCH) {
					if (currentInstruction.default_value === "on") {
						form.setFieldsValue({
							switch_on: true,
							switch_off: false,
						})
					} else {
						form.setFieldsValue({
							switch_on: false,
							switch_off: true,
						})
					}
				}
				if (currentInstruction.type === InstructionType.SINGLE_CHOICE) {
					setFieldValues(currentInstruction.values)
				} else {
					setCurrentInstructionExp(currentInstruction.instruction_explanation)
				}

				if (currentInstruction.type !== InstructionType.STATUS) {
					editorRef.current?.editor?.commands.setContent(
						combindContent(currentInstruction.content),
					)
				}
				setInstructionMode(currentInstruction.instruction_type || InstructionModeType.Chat)
				updateSendCommandVisibility(
					currentInstruction.residency,
					currentInstruction.instruction_type,
				)
				updateInsertLocationVisibility(
					currentInstruction.residency,
					currentInstruction.send_directly,
					currentInstruction.instruction_type,
				)

				setSelectedValue(currentInstruction.type)
			}
		}, [
			currentInstruction,
			form,
			edit,
			setSelectedValue,
			updateInsertLocationVisibility,
			updateSendCommandVisibility,
		])

		const handleFormChange = useMemoizedFn((changeValues) => {
			if ("switch_on" in changeValues && changeValues.switch_on) {
				form.setFieldValue("switch_off", false)
			}
			if ("switch_off" in changeValues && changeValues.switch_off) {
				form.setFieldValue("switch_on", false)
			}
		})

		/** 编辑器配置 */
		const editorOptions = useMemo<UseEditorOptions>(
			() => ({
				editable: true,
				extensions: [QuickInstructionNodeTemplateExtension],
				onUpdate: ({ editor }) => {
					const content = editor.getJSON()
					form.setFieldValue("content", JSON.stringify(pickContent(content)))
				},
			}),
			[form],
		)

		/** 插入指令值 */
		const insertInstruction = useMemoizedFn(() => {
			editorRef.current?.editor?.commands.insertContent(
				genTemplateInstructionNode(currentInstruction),
			)
		})

		// 保存指令说明
		const innerSaveInstructionExp = useMemoizedFn(
			(val: InstructionExplanation, index?: number) => {
				const type = form.getFieldValue("type")
				if (type === InstructionType.SINGLE_CHOICE && index !== undefined) {
					const values = form.getFieldValue("values")
					if (values[index]) {
						values[index].instruction_explanation = val
					} else {
						values[index] = {
							instruction_explanation: val,
						}
					}
					setFieldValues(values)
					form.setFieldValue("values", values)
				} else {
					form.setFieldValue("instruction_explanation", val)
					setCurrentInstructionExp(val)
				}
			},
		)

		/** 指令常驻改变 */
		const InstructionResidencyChange = useMemoizedFn((checked: boolean) => {
			updateSendCommandVisibility(checked, instructionMode)
			updateInsertLocationVisibility(
				checked,
				form.getFieldValue("send_directly"),
				instructionMode,
			)
		})

		/** 直接发送指令改变 */
		const SendCommandChange = useMemoizedFn((checked: boolean) => {
			updateInsertLocationVisibility(
				form.getFieldValue("residency"),
				checked,
				instructionMode,
			)
		})

		/* 指令模式改变 */
		const InstructionModeChange = useMemoizedFn((mode: InstructionModeType) => {
			setInstructionMode(mode)
			updateSendCommandVisibility(form.getFieldValue("residency"), mode)
			updateInsertLocationVisibility(
				form.getFieldValue("residency"),
				form.getFieldValue("send_directly"),
				mode,
			)
		})

		/* 指令类型改变 */
		const InstructionTypeChange = useMemoizedFn((value: InstructionType) => {
			setSelectedValue(value)
			switch (value) {
				case InstructionType.TEXT:
					if (form.getFieldValue("send_directly")) {
						setShowInsertLocation(false)
					} else {
						setShowInsertLocation(true)
					}
					break
				case InstructionType.SINGLE_CHOICE:
					updateInsertLocationVisibility(
						form.getFieldValue("residency"),
						form.getFieldValue("send_directly"),
						instructionMode,
					)
					break
				default:
					break
			}
		})

		const shouldShowSendCommand = useMemo(() => {
			return (
				(selectedValue === InstructionType.SINGLE_CHOICE && showSendCommand) ||
				selectedValue === InstructionType.TEXT
			)
		}, [selectedValue, showSendCommand])

		return (
			<Form
				form={form}
				validateMessages={{ required: t("form.required") }}
				layout="vertical"
				className={styles.form}
				onFinish={onFinish}
				onValuesChange={handleFormChange}
			>
				<Form.Item name="id" noStyle />
				{/* 基础信息 */}
				<Flex vertical gap={8}>
					<div className={styles.formSubTitle}>{t("explore.form.baseInfo")}</div>
					<Form.Item
						name="name"
						label={t("explore.form.instructionName")}
						required
						rules={[{ required: true }]}
					>
						<Input
							placeholder={t("explore.form.instructionNamePlaceholder")}
							className={styles.input}
						/>
					</Form.Item>
					<Form.Item name="description" label={t("explore.form.instructionDesc")}>
						<Input.TextArea
							rows={4}
							placeholder={t("explore.form.instructionDescPlaceholder")}
							className={styles.input}
						/>
					</Form.Item>
				</Flex>
				{/* 指令配置 */}
				<Flex vertical gap={8}>
					<div className={styles.formSubTitle}>
						{t("explore.form.instructionSetting")}
					</div>
					<Form.Item
						name="type"
						label={t("explore.form.instructionType")}
						rules={[{ required: true }]}
						initialValue={selectedValue}
					>
						<Select
							onSelect={InstructionTypeChange}
							style={{ width: "100%" }}
							optionLabelProp="label"
							className={styles.select}
							dropdownRender={(menu) => <div className={styles.dropdown}>{menu}</div>}
						>
							{options.map((item) => {
								return (
									<Select.Option
										value={item.value}
										key={item.value}
										label={item.label}
									>
										<Flex align="center">
											<div className={styles.optionIcon}>
												{selectedValue === item.value && (
													<IconCheckTick size={20} />
												)}
											</div>
											<span>{item.label}</span>
										</Flex>
									</Select.Option>
								)
							})}
						</Select>
					</Form.Item>
					{selectedValue === InstructionType.SINGLE_CHOICE && (
						<SingleChoice
							fieldValues={fieldValues}
							onFinish={innerSaveInstructionExp}
						/>
					)}
					{selectedValue === InstructionType.SWITCH && <SwitchOption />}
					{selectedValue === InstructionType.STATUS && <StatusButton form={form} />}
				</Flex>
				{/* 指令常驻 */}
				{useInstructionResidency.includes(selectedValue) && (
					<InstructionResidency onHiddenInsertLocation={InstructionResidencyChange} />
				)}
				{/* 指令模式 */}
				{useInstructionModel.includes(selectedValue) && (
					<InstructionMode instructionModeChange={InstructionModeChange} />
				)}
				{/* 指令内容 */}
				{(isChatMode || selectedValue === InstructionType.TEXT) &&
					selectedValue !== InstructionType.STATUS && (
						<InstructionContent
							selectedValue={selectedValue}
							insertInstruction={insertInstruction}
							editorRef={editorRef}
							editorOptions={editorOptions}
						/>
					)}
				{/* 指令说明 */}
				{((selectedValue === InstructionType.SWITCH && isChatMode) ||
					selectedValue === InstructionType.TEXT) && (
					<Form.Item name="instruction_explanation" noStyle>
						<ToolTipButton
							type="button"
							initialValues={currentInstructionExp}
							onFinish={innerSaveInstructionExp}
						/>
					</Form.Item>
				)}

				{/* 直接发送指令 */}
				{shouldShowSendCommand && (
					<SendCommand onHiddenInsertLocation={SendCommandChange} />
				)}

				{/* 指令插入位置 */}
				{useSendCommand.includes(selectedValue) && showInsertLocation && <InsertLocation />}
			</Form>
		)
	},
)

export default InstructionForm
