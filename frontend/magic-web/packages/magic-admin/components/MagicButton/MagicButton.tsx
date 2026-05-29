import { Button, type ButtonProps } from "antd"
import type { CSSProperties } from "react"
import { forwardRef, memo } from "react"
import { useStyles } from "./style"

export interface MagicButtonProps extends ButtonProps {
	justify?: CSSProperties["justifyContent"]
}

const MagicButton = forwardRef<HTMLButtonElement, MagicButtonProps>(
	({ className, children, type, justify = "center", ...props }: MagicButtonProps, ref) => {
		const { styles, cx } = useStyles({ justify })
		return (
			<Button
				ref={ref}
				type={type}
				className={cx(styles.magicButton, className, {
					[styles.link]: type === "link",
				})}
				{...props}
			>
				{children}
			</Button>
		)
	},
)

export default memo(MagicButton)
