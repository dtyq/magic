import { Select, type SelectProps } from "antd"
import { IconChevronDown } from "@tabler/icons-react"
import type { ComponentType } from "react"
import { useStyles } from "./style"
import { useAdminComponents } from "../AdminComponentsProvider"

export type MagicSelectProps = SelectProps

const MagicSelectComponent = ({ className, placeholder, ...props }: MagicSelectProps) => {
	const { styles, cx } = useStyles()
	const { getLocale } = useAdminComponents()
	const locale = getLocale("MagicSelect")

	return (
		<Select
			placeholder={placeholder || locale.pleaseSelect}
			className={cx(styles.magicSelect, className)}
			suffixIcon={<IconChevronDown size={16} className={styles.suffixIcon} />}
			{...props}
		/>
	)
}

const MagicSelect = MagicSelectComponent as ComponentType<MagicSelectProps> & {
	Option: typeof Select.Option
}

MagicSelect.Option = Select.Option

export default MagicSelect
