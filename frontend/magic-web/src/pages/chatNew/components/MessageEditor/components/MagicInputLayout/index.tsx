import { Flex, FlexProps } from "antd"
import { cx } from "antd-style"
import type { ReactNode } from "react"
import { forwardRef, memo } from "react"
import useInputStyles from "../../hooks/useInputStyles"
import { IMStyle } from "@/providers/AppearanceProvider/context"

interface ChildrenProps {
	className: string
}

interface InputLayoutProps extends Omit<FlexProps, "children"> {
	theme: IMStyle
	extra: ReactNode
	buttons: ReactNode
	footer: ReactNode
	disabled?: boolean
	children: (props: ChildrenProps) => ReactNode
	inputMainClassName?: string
}

const MagicInputLayout = memo(
	forwardRef<HTMLElement, InputLayoutProps>((props, ref) => {
		const { theme, className, extra, buttons, footer, children, disabled, ...rest } = props

		const { standardStyles, modernStyles } = useInputStyles({ disabled })

		if (theme === IMStyle.Standard) {
			return (
				<Flex vertical className={cx(standardStyles.container, className)} {...rest}>
					{/* <Flex vertical gap={8} className={cx(standardStyles.main, inputMainClassName)}> */}
					{extra ? (
						<Flex wrap="wrap" vertical className={standardStyles.extra}>
							{extra}
						</Flex>
					) : null}
					{buttons}
					{children({
						className: standardStyles.input,
					})}
					{/* <AtMentions value={value} onChange={setState} /> */}
					{footer}
					{/* </Flex> */}
				</Flex>
			)
		}

		return (
			<Flex
				ref={ref}
				vertical
				className={cx(className, modernStyles.marginSelection)}
				{...rest}
			>
				<Flex wrap="wrap" vertical className={modernStyles.extra}>
					{extra}
				</Flex>
				<Flex wrap="wrap" gap={8} justify="flex-end" className={modernStyles.main}>
					{children({
						className: modernStyles.input,
					})}
					<Flex align="flex-end" justify="flex-end">
						<Flex className={modernStyles.footer} align="center" gap={4}>
							{buttons}
							{footer}
						</Flex>
					</Flex>
				</Flex>
			</Flex>
		)
	}),
)

export default MagicInputLayout
