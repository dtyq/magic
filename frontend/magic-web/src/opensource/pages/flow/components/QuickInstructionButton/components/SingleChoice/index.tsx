import { Flex, Form, Input } from "antd"
import { useTranslation } from "react-i18next"
import MagicButton from "@/opensource/components/base/MagicButton"
import { IconCircleMinus, IconPlus } from "@tabler/icons-react"
import { memo } from "react"
import type { InstructionExplanation, InstructionValue } from "@/opensource/types/bot"
import { useStyles } from "../../styles"
import { ToolTipButton } from "../ToolTipButton"

interface SingleChoiceProps {
	fieldValues: InstructionValue[]
	onFinish: (val: InstructionExplanation, index?: number) => void
}

const SingleChoice = memo(({ fieldValues, onFinish }: SingleChoiceProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()

	return (
		<Form.List name="values" initialValue={[""]}>
			{(fields, { add, remove }) => (
				<>
					<Flex gap={6} vertical>
						<Flex gap={6} align="center">
							<div style={{ minWidth: 80 }} />
							<span className={styles.optionText}>
								{t("explore.form.optionName")}
							</span>
							<span className={styles.optionText}>
								{t("explore.form.optionValue")}
							</span>
							<div style={{ minWidth: 66 }} />
						</Flex>
						<Flex gap={6} align="flex-start">
							<span className={cx(styles.labelText, styles.required)}>
								{`${t("explore.form.option")} 1`}
							</span>
							{/* 手动渲染第一个字段 */}
							<Form.Item
								name={[0, "name"]} // 第一个字段对应数组的第一个元
								style={{ flex: 1 }}
								rules={[
									{
										required: true,
										message: t("explore.form.optionNamePlaceholder"),
									},
								]}
							>
								<Input
									placeholder={t("explore.form.optionNamePlaceholder")}
									className={styles.input}
								/>
							</Form.Item>
							{/* 手动渲染第一个字段 */}
							<Form.Item
								name={[0, "value"]} // 第一个字段对应数组的第一个元素
								style={{ flex: 1 }}
								rules={[
									{
										required: true,
										message: t("explore.form.optionValuePlaceholder"),
									},
								]}
							>
								<Input
									placeholder={t("explore.form.optionValuePlaceholder")}
									className={styles.input}
								/>
							</Form.Item>
							<Form.Item name="instruction_explanation" noStyle>
								<ToolTipButton
									type="icon"
									initialValues={
										fieldValues[0]?.instruction_explanation ||
										({} as InstructionExplanation)
									}
									onFinish={(val) => onFinish(val, 0)}
								/>
							</Form.Item>
							<MagicButton
								type="text"
								className={styles.button}
								disabled={fields.length === 1}
								icon={<IconCircleMinus size={16} />}
								onClick={() => remove(0)}
							/>
						</Flex>
						{/* 动态渲染其余字段 */}
						{fields
							.filter((field) => field.name !== 0) // 过滤掉第一个字段
							.map((field, index) => (
								<Flex gap={6} align="center" key={field.key}>
									<span className={cx(styles.labelText, styles.required)}>
										{`${t("explore.form.option")} ${index + 2}`}
									</span>
									<Form.Item
										name={[field.name, "name"]}
										style={{ flex: 1 }}
										rules={[
											{
												required: true,
												message: t("explore.form.optionNamePlaceholder"),
											},
										]}
									>
										<Input
											placeholder={t("explore.form.optionNamePlaceholder")}
											className={styles.input}
										/>
									</Form.Item>
									<Form.Item
										name={[field.name, "value"]}
										style={{ flex: 1 }}
										rules={[
											{
												required: true,
												message: t("explore.form.optionValuePlaceholder"),
											},
										]}
									>
										<Input
											placeholder={t("explore.form.optionValuePlaceholder")}
											className={styles.input}
										/>
									</Form.Item>
									<Form.Item name="instruction_explanation" noStyle>
										<ToolTipButton
											type="icon"
											initialValues={
												fieldValues[field.name]?.instruction_explanation ||
												({} as InstructionExplanation)
											}
											onFinish={(val) => onFinish(val, field.name)}
										/>
									</Form.Item>
									<MagicButton
										type="text"
										className={styles.button}
										disabled={fields.length === 1}
										icon={<IconCircleMinus size={16} />}
										onClick={() => remove(field.name)}
									/>
								</Flex>
							))}
					</Flex>
					<Form.Item>
						<MagicButton
							className={styles.button}
							icon={<IconPlus size={16} />}
							onClick={() => add()}
						>
							{t("explore.buttonText.addOption")}
						</MagicButton>
					</Form.Item>
				</>
			)}
		</Form.List>
	)
})

export default SingleChoice
