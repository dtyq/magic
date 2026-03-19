import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { RadioChangeEvent } from "antd"
import { Flex, Form, Radio } from "antd"
import { InstructionMode as InstructionModeType } from "@/types/bot"
import { useStyles } from "../../styles"

interface InstructionModeProps {
	instructionModeChange: (mode: InstructionModeType) => void
}

export const InstructionMode = memo(({ instructionModeChange }: InstructionModeProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()

	const options = useMemo(
		() => [
			{
				value: InstructionModeType.Flow,
				label: (
					<Flex vertical gap={4}>
						<div>{t("explore.form.flowInstruction")}</div>
						<div className={styles.desc}>{t("explore.form.flowInstructionTip")}</div>
					</Flex>
				),
			},
			{
				value: InstructionModeType.Chat,
				label: (
					<Flex vertical gap={4}>
						<div>{t("explore.form.chatInstruction")}</div>
						<div className={styles.desc}>{t("explore.form.chatInstructionTip")}</div>
					</Flex>
				),
			},
		],
		[t, styles.desc],
	)

	const onChange = (e: RadioChangeEvent) => {
		const { value } = e.target
		instructionModeChange(value)
	}

	return (
		<Flex vertical gap={8}>
			<div className={styles.formSubTitle}>{t("explore.form.instructionMode")}</div>
			<Form.Item name="instruction_type" initialValue={InstructionModeType.Chat}>
				<Radio.Group
					options={options}
					onChange={onChange}
					className={cx(styles.radioGroup, styles.specialRadioGroup)}
				/>
			</Form.Item>
		</Flex>
	)
})
