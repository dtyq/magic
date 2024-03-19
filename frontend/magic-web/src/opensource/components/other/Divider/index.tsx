import { createStyles } from "antd-style"
import { memo } from "react"

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
	direction: "horizontal" | "vertical"
}

const useStyles = createStyles(({ css, token }) => {
	return {
		horizontal: css`
			width: 100%;
			color: ${token.colorBorder};
			border-top: 1px solid ${token.colorBorder};

			&:last-child {
				display: none;
			}
		`,
		vertical: css`
			height: 100%;
			color: ${token.colorBorder};
			border-left: 1px solid ${token.colorBorder};

			&:last-child {
				display: none;
			}
		`,
	}
})

const Divider = memo(({ direction, className, ...rest }: DividerProps) => {
	const { styles, cx } = useStyles()
	return <div className={cx(styles[direction], className)} {...rest} />
})

export default Divider
