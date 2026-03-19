import type { PropsWithChildren } from "react"
import classNames from "classnames"

import styles from "./index.module.css"

interface IconButtonProps extends React.HTMLAttributes<HTMLDivElement> {
	selected?: boolean
	disabled?: boolean
}

export default function IconButton(props: PropsWithChildren<IconButtonProps>) {
	const { selected, disabled, className, children, onClick, ...rest } = props

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (disabled) {
			return
		}
		onClick?.(e)
	}

	return (
		<div
			className={classNames(
				styles.iconButton,
				selected && styles.selected,
				disabled && styles.disabled,
				className,
			)}
			onClick={handleClick}
			{...rest}
		>
			{children}
		</div>
	)
}
