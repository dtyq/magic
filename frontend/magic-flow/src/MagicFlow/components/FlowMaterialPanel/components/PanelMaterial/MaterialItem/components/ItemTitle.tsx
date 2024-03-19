import React, { memo } from "react"
import { IconHelp } from "@tabler/icons-react"
import { Tooltip } from "antd"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../index.module.less"

interface ItemTitleProps {
	label: string
	desc?: string
}

const ItemTitle = memo(({ label, desc }: ItemTitleProps) => {
	return (
		<>
			<span className={clsx(styles.title, `${prefix}title`)}>{label}</span>
			{desc && (
				<Tooltip title={desc} showArrow={false}>
					<IconHelp
						color="#1C1D2359"
						size={22}
						className={clsx(styles.help, `${prefix}help`)}
					/>
				</Tooltip>
			)}
		</>
	)
})

export default ItemTitle
