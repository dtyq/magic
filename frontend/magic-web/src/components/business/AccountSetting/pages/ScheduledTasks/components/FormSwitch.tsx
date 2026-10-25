import { Switch } from "@/components/shadcn-ui/switch"

interface FormSwitchProps {
	checked?: boolean
	value?: boolean
	disabled?: boolean
	onChange?: (checked: boolean) => void
}

/**
 * shadcn Switch adapter for antd Form.Item.
 * Form.Item injects `checked` (valuePropName="checked") or `value` plus
 * `onChange(checked)`, while Radix uses `checked` / `onCheckedChange`.
 */
function FormSwitch({ checked, value, disabled, onChange }: FormSwitchProps) {
	return (
		<Switch
			checked={Boolean(checked ?? value)}
			disabled={disabled}
			onCheckedChange={onChange}
		/>
	)
}

export { FormSwitch }
