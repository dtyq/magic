import { useEffect, useRef, type FC } from "react"
import { Flex, Popover } from "antd"
import type { PopoverProps } from "antd"
import { useControllableValue, useUpdateEffect } from "ahooks"
import { omit } from "lodash-es"
import { useStyles } from "./styles"

interface InputingProps extends Omit<PopoverProps, "content"> {
	open: boolean
}

const Inputing: FC<InputingProps> = (props) => {
	const { children, open: initOpen, ...restProps } = props
	const { styles } = useStyles()

	const [open, setOpen] = useControllableValue(props, {
		defaultValue: false,
		defaultValuePropName: "open",
	})
	const timer = useRef<NodeJS.Timeout | undefined>(undefined)

	useUpdateEffect(() => {
		setOpen(initOpen)
	}, [initOpen, setOpen])

	useEffect(() => {
		if (initOpen) {
			setOpen(true)
			timer.current = setTimeout(() => {
				setOpen(false)
				timer.current = undefined
			}, 10 * 1000)
		} else if (timer.current) {
			clearTimeout(timer.current)
			timer.current = undefined
		}

		return () => {
			if (timer.current) {
				clearTimeout(timer.current)
				timer.current = undefined
			}
		}
	}, [initOpen, setOpen])

	return (
		<Popover
			open={open}
			placement="topLeft"
			rootClassName={styles.root}
			content={
				<Flex align="center" justify="center" gap={4}>
					<div className={styles.inputing} />
					<div className={styles.inputing} />
					<div className={styles.inputing} />
				</Flex>
			}
			autoAdjustOverflow={false}
			getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
			{...omit(restProps, ["open"])}
		>
			{children}
		</Popover>
	)
}

export default Inputing
