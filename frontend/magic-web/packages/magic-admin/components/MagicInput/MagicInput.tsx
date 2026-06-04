import { Input, type InputProps } from "antd"
import { useStyles } from "./style"
import { useAdminComponents } from "../AdminComponentsProvider"

export type MagicInputProps = InputProps

const MagicInput = ({ className, placeholder, ...props }: MagicInputProps) => {
	const { styles, cx } = useStyles()
	const { getLocale } = useAdminComponents()
	const locale = getLocale("MagicInput")

	return (
		<Input
			className={cx(styles.magicInput, className)}
			placeholder={placeholder || locale.pleaseInput}
			{...props}
		/>
	)
}

MagicInput.TextArea = Input.TextArea
MagicInput.Password = Input.Password

export default MagicInput
