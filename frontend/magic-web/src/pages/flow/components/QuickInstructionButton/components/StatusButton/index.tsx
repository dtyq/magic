import { Flex, Form } from "antd"
import { useTranslation } from "react-i18next"
import MagicButton from "@/components/base/MagicButton"
import { IconPlus } from "@tabler/icons-react"
import { memo } from "react"
import type { InstructionStatus, QuickInstruction } from "@/types/bot"
import type { FormInstance } from "antd"
import { useMemoizedFn } from "ahooks"
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { DndContext } from "@dnd-kit/core"
import { useStyles } from "../../styles"
import FormItem from "./components/FormItem"

interface StatusButtonProps {
	form: FormInstance<QuickInstruction & { switch_on: boolean; switch_off: boolean }>
}

const StatusButton = memo(({ form }: StatusButtonProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()

	const onDragEnd = useMemoizedFn((event, fields: any[]) => {
		const { active, over } = event

		if (!over || !active) return

		const activeId = active.id
		const overId = over.id

		const values = form.getFieldValue("values")

		const activeIdx = fields.findIndex((field) => field.key === activeId)
		const overIdx = fields.findIndex((field) => field.key === overId)

		const newValues = arrayMove(values, activeIdx, overIdx) as InstructionStatus[]

		const switchIndex = newValues.findIndex((item) => item.switch)
		form.setFieldsValue({ default_value: switchIndex + 1 })
		form.setFieldsValue({ values: newValues })
	})

	return (
		<Form.List name="values" initialValue={[""]}>
			{(fields, { add, remove }) => {
				const disabled = fields.length === 2
				const ids = fields.map((field) => field.name)

				return (
					<DndContext onDragEnd={(event) => onDragEnd(event, fields)}>
						<SortableContext items={ids} strategy={verticalListSortingStrategy}>
							<Flex gap={6} vertical>
								<Flex gap={6} align="center">
									<div style={{ minWidth: 88 }} />
									<span className={cx(styles.optionText, styles.optionShortText)}>
										{t("explore.form.statusIcon")}
									</span>
									<span className={styles.optionText}>
										{t("explore.form.statusText")}
									</span>
									<span className={styles.optionText}>
										{t("explore.form.statusTextColor")}
									</span>
									<span className={styles.optionText}>
										{t("explore.form.optionValue")}
									</span>
									<span className={cx(styles.optionText, styles.optionShortText)}>
										{t("explore.form.defaultValue")}
									</span>
									<div style={{ minWidth: 32 }} />
								</Flex>
								<FormItem
									remove={remove}
									key={0}
									name={0}
									disabled={disabled}
									form={form}
								/>
								<FormItem
									remove={remove}
									key={1}
									name={1}
									disabled={disabled}
									form={form}
								/>
								{fields
									.filter((field) => field.name !== 0 && field.name !== 1)
									.map((field) => (
										<FormItem
											remove={remove}
											key={field.key}
											name={field.name}
											disabled={disabled}
											form={form}
										/>
									))}
							</Flex>
							<Form.Item>
								<MagicButton
									className={styles.button}
									icon={<IconPlus size={16} />}
									onClick={() => add()}
								>
									{t("explore.buttonText.addStatus")}
								</MagicButton>
							</Form.Item>
							<span className={styles.desc}>{t("explore.form.statusTip")}</span>
						</SortableContext>
					</DndContext>
				)
			}}
		</Form.List>
	)
})

export default StatusButton
