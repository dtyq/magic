import type { ButtonProps } from "antd-mobile"
import { Button } from "antd-mobile"
import type { PropsWithChildren } from "react"
import { memo } from "react"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ token }) => {
	return {
		button: {
			display: "flex !important",
			alignItems: "center",
			justifyContent: "center",
			borderRadius: "8px !important",
			position: "relative",
			fontSize: "inherit !important",
			overflow: "hidden",

			"& > span": {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
			},

			"&::before": {
				borderRadius: 8,
				transform: "none",
			},
		},
		borderDisabled: {
			border: "none !important",
			"&::before": {
				border: "none",
			},
		},
	}
})
interface MobileButtonProps extends ButtonProps {
	borderDisabled?: boolean
}

export default memo(function MobileButton(props: PropsWithChildren<MobileButtonProps>) {
	const { children, borderDisabled, ...buttonProps } = props
	const { styles } = useStyles()
	return (
		<Button
			{...buttonProps}
			className={`${styles.button} ${buttonProps.className} ${
				borderDisabled ? styles.borderDisabled : ""
			}`}
		>
			{children}
		</Button>
	)
})
