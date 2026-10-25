// @ts-nocheck

import {
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
} from "@tabler/icons-react"
import { DatePicker } from "antd"
import React, { forwardRef } from "react"
import style from "./style.module.less"

// 定义 TsDatePicker 的 Props 类型
type TsDatePickerProps = React.ComponentProps<typeof DatePicker> & {
	className?: string
}

const TsDatePicker = forwardRef<HTMLDivElement, TsDatePickerProps>((props, ref) => (
	<DatePicker
		prevIcon={<IconChevronLeft size="18" />}
		nextIcon={<IconChevronRight size="18" />}
		superNextIcon={<IconChevronsRight size="18" />}
		superPrevIcon={<IconChevronsLeft size="18" />}
		{...props}
		className={`${style.tsDatePicker} ${props.className || ""}`}
		ref={ref}
	/>
))

// 定义 RangePicker 的 Props 类型
type RangePickerProps = React.ComponentProps<typeof DatePicker.RangePicker> & {
	className?: string
}

TsDatePicker.RangePicker = forwardRef<HTMLDivElement, RangePickerProps>((props, ref) => (
	<DatePicker.RangePicker
		{...props}
		className={`${style.tsRangePicker} ${props.className || ""}`}
		ref={ref}
	/>
))

export default TsDatePicker
