import { type InputNumberProps, InputNumber } from "antd"
import { useStyles } from "./style"

export type MagicInputNumberProps = InputNumberProps

const MagicInputNumber = ({ className, ...props }: MagicInputNumberProps) => {
	const { styles, cx } = useStyles()

	return <InputNumber className={cx(styles.magicInputNumber, className)} {...props} />
}

export default MagicInputNumber
