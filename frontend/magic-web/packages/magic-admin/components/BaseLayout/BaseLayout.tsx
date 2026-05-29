import { Flex } from "antd"
import type { PropsWithChildren } from "react"
import { memo } from "react"
import { useStyles } from "./style"
import type { ButtonGroupProps } from "../ButtonGroup"
import ButtonGroup from "../ButtonGroup"

export interface BaseLayoutProps extends PropsWithChildren {
	isMobile?: boolean
	/** 类名 */
	className?: string
	/** 样式 */
	style?: React.CSSProperties
	/** 内容容器类名 */
	contentClassName?: string
	/** 底部容器类名 */
	footerContainerClassName?: string
	/* buttonGroup props */
	buttonGroupProps?: ButtonGroupProps
}

const BaseLayout = ({
	isMobile,
	children,
	className,
	style,
	footerContainerClassName,
	contentClassName,
	buttonGroupProps,
}: BaseLayoutProps) => {
	const { styles, cx } = useStyles({ isMobile })

	return (
		<Flex vertical className={cx(styles.container, className)} style={style}>
			<div className={cx(styles.content, contentClassName)}>{children}</div>
			<div className={cx(styles.footer, footerContainerClassName)}>
				<ButtonGroup
					className={cx(styles.footerContent, buttonGroupProps?.className)}
					{...buttonGroupProps}
				/>
			</div>
		</Flex>
	)
}

export default memo(BaseLayout)
