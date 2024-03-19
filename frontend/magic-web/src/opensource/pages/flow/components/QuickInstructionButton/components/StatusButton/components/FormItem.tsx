import { memo } from "react"
import type { FormInstance } from "antd"
import { Button, Flex, Form, Input, Select, Switch } from "antd"
import { useTranslation } from "react-i18next"
import MagicButton from "@/opensource/components/base/MagicButton"
import { IconCircleMinus, IconGripVertical } from "@tabler/icons-react"
import type { InstructionStatus, QuickInstruction } from "@/opensource/types/bot"
import { StatusTextColor } from "@/opensource/types/bot"
import { useSortable } from "@dnd-kit/sortable"
import { useMemoizedFn } from "ahooks"
import { useStyles } from "../../../styles"
import IconSelectPopover from "./IconSelectPopover"
import { DEFAULT_ICON } from "../../../const"
import type { StatusIconKey } from "../../../StatusIcons"

interface FormItemProps {
	name: number
	disabled: boolean
	form: FormInstance<QuickInstruction & { switch_on: boolean; switch_off: boolean }>
	remove: (index: number) => void
}

const FromItem = memo(({ name, form, disabled, remove }: FormItemProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()

	const { attributes, listeners, setNodeRef, transform, transition, isSorting } = useSortable({
		id: name,
	})

	const options = [
		{
			label: t("explore.form.statusTextColorDefault"),
			value: StatusTextColor.DEFAULT,
		},
		{
			label: t("explore.form.statusTextColorGreen"),
			value: StatusTextColor.GREEN,
		},
		{
			label: t("explore.form.statusTextColorOrange"),
			value: StatusTextColor.ORANGE,
		},
		{
			label: t("explore.form.statusTextColorRed"),
			value: StatusTextColor.RED,
		},
	]

	const style = {
		transform: isSorting
			? `translate3d(${transform?.x}px, ${transform?.y}px, 0)`
			: "translate3d(0, 0, 0)",
		transition,
		cursor: "grab",
		zIndex: 9999,
	}

	const onChangeSwitch = useMemoizedFn((index: number, checked: boolean) => {
		const values = form.getFieldValue("values")
		if (checked) {
			form.setFieldsValue({
				values: values.map((item: InstructionStatus, i: number) =>
					i === index ? { ...item, switch: true } : { ...item, switch: false },
				),
			})
		} else {
			form.setFieldsValue({
				values: values.map((item: InstructionStatus, i: number) =>
					i === 0 ? { ...item, switch: true } : { ...item, switch: false },
				),
			})
		}
	})

	const onChangeIcon = useMemoizedFn((index: number, icon: StatusIconKey) => {
		const values = form.getFieldValue("values")
		form.setFieldsValue({
			values: values.map((item: InstructionStatus, i: number) =>
				i === index ? { ...item, icon } : item,
			),
		})
	})

	const currentIcon = form.getFieldValue("values")?.[name]?.icon || DEFAULT_ICON

	return (
		<Flex gap={6} align="flex-start" ref={setNodeRef} {...attributes} style={style}>
			<Button
				type="text"
				size="small"
				icon={<IconGripVertical size={18} />}
				className={styles.commonIcon2}
				style={{ cursor: "grabbing" }}
				{...listeners}
			/>
			<span className={cx(styles.labelText, styles.required)} style={{ minWidth: 54 }}>
				{`${t("flow.apiKey.status")} ${name + 1}`}
			</span>
			<IconSelectPopover name={name} onChangeIcon={onChangeIcon} formIcon={currentIcon} />
			<Form.Item
				name={[name, "status_text"]}
				style={{ flex: 1 }}
				rules={[
					{
						required: true,
						message: t("explore.form.statusTextPlaceholder"),
					},
				]}
			>
				<Input
					placeholder={t("explore.form.statusTextPlaceholder")}
					className={styles.input}
				/>
			</Form.Item>
			<Form.Item
				name={[name, "text_color"]}
				style={{ flex: 1 }}
				initialValue={StatusTextColor.DEFAULT}
			>
				<Select options={options} className={styles.select} />
			</Form.Item>
			<Form.Item
				name={[name, "value"]}
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
			<Form.Item name={[name, "switch"]} noStyle initialValue={name === 0}>
				<Switch
					className={styles.switch}
					onChange={(checked) => onChangeSwitch(name, checked)}
				/>
			</Form.Item>
			<MagicButton
				type="text"
				className={styles.button}
				disabled={disabled}
				icon={<IconCircleMinus size={16} color="currentColor" />}
				onClick={() => remove(name)}
			/>
		</Flex>
	)
})
export default FromItem
