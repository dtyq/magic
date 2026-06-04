import type { RadioGroupProps, RadioProps } from "antd"
import { Radio } from "antd"
import { useStyles } from "./style"

export type MagicRadioProps = RadioProps
export type MagicRadioGroupProps = RadioGroupProps

const MagicRadio = ({ className, type, ...props }: RadioProps) => {
	return <Radio {...props} />
}

const MagicRadioGroup = ({ className, ...props }: MagicRadioGroupProps) => {
	const { styles, cx } = useStyles()
	return <Radio.Group className={cx(styles.magicRadioGroup, className)} {...props} />
}

MagicRadio.Group = MagicRadioGroup

export default MagicRadio
