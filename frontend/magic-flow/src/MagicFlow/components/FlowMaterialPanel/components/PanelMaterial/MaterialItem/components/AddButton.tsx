import React, { memo } from "react"
import { IconPlus } from "@tabler/icons-react"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../index.module.less"

interface AddButtonProps {
	onAddItem: () => void
}

const AddButton = memo(({ onAddItem }: AddButtonProps) => {
	return (
		<IconPlus
			className={clsx(styles.plus, `${prefix}plus`)}
			onClick={onAddItem}
			stroke={2}
			size={20}
		/>
	)
})

export default AddButton
