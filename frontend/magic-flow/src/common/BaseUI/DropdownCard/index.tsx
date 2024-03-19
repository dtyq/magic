import { IconChevronDown, IconChevronRight } from "@douyinfe/semi-icons"
import { useMemoizedFn } from "ahooks"
import clsx from "clsx"
import React, { ReactElement, useMemo, useRef, useState } from "react"
import styles from "./index.module.less"

type DropdownCardProp = React.PropsWithChildren<{
	title: string
	defaultExpand?: boolean
	headerClassWrapper?: string
	suffixIcon?: ReactElement
	height?: string
	className?: string
	[key: string]: any
}>

export default function DropdownCard({
	children,
	title,
	defaultExpand = true,
	headerClassWrapper,
	suffixIcon,
	height: dropdownHeight,
	...props
}: DropdownCardProp) {
	const [isExpand, setIsExpand] = useState(defaultExpand)
	const ref = useRef<HTMLDivElement>(null)

	const updateExpand = useMemoizedFn((expand: boolean) => {
		setIsExpand(expand)
	})

	const Icon = useMemo(() => {
		return isExpand ? IconChevronDown : IconChevronRight
	}, [isExpand])

	return (
		<div
			{...props}
			className={clsx(styles.dropdownCard, "dropdown-card", props.className || "")}
		>
			<div className={clsx(styles.outputDropdown, headerClassWrapper, "output-dropdown")}>
				<div className={clsx(styles.left, "left")}>
					<Icon className={styles.icon} onClick={() => updateExpand(!isExpand)} />
					<span className={styles.text}>{title}</span>
				</div>
				<div className={styles.right}>{suffixIcon}</div>
			</div>
			<div
				className={clsx(styles.form, {
					[styles.zeroHeight]: !isExpand,
				})}
				style={{
					height: "auto",
					overflow: !isExpand ? "hidden" : "visible",
				}}
				ref={ref}
			>
				{children}
			</div>
		</div>
	)
}
