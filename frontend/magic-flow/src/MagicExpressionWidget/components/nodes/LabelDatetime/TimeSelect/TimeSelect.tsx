import React, { useMemo, useRef, useState } from "react"

import TsDatePicker from "@/common/BaseUI/DatePicker"
import TSIcon from "@/common/BaseUI/TSIcon"
import { Divider } from "antd"
import { IconCheck } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import dayjs from "dayjs"
import i18next from "i18next"
import { useTranslation } from "react-i18next"
import { timeSelectOptions } from "./constants"
import "./index.less"
import { TimeSelectProps, TimeSelectType } from "./type"

const TimeSelect = ({
	value,
	options = timeSelectOptions,
	placeholder = "YYYY-MM-DD",
	onChange,
}: TimeSelectProps) => {
	const { t } = useTranslation()
	const [dataTimeOpen, setDataTimeOpen] = useState(false)
	const [open, setOpen] = useState(false)

	const selectContainerRef = useRef<HTMLDivElement>(null)
	const popupContainerRef = useRef<HTMLDivElement>(null)
	const wrapperRef = useRef<HTMLDivElement>(null)

	const selectRef = useRef<any>()

	const val = useMemo(() => {
		return value && Object.prototype.toString.call(value) === "[object Object]"
			? [value.type]
			: []
	}, [value])

	const showTime = useMemo(() => {
		return placeholder.includes(":")
	}, [placeholder])

	const handleExactDate = useMemoizedFn((date) => {
		const str = dayjs(date).format(placeholder)
		onChange({ type: TimeSelectType.Designation, value: str })
		if (!showTime) setDataTimeOpen(false)
	})

	const onSelectItem = useMemoizedFn((val: any) => {
		/** 处理单选 */
		onChange?.(val)
	})

	return (
		<div className="magic-time-select" ref={wrapperRef}>
			<div
				className="time-select"
				ref={selectContainerRef}
				onMouseDown={(e) => e.preventDefault()}
			>
				<div className="dropdown-list">
					{timeSelectOptions.map((option) => {
						return (
							<div
								className="dropdown-item"
								onClick={() => {
									onSelectItem(option.value)
								}}
							>
								<div className="label">{option.label}</div>
								{value === option.value && <IconCheck className="tick" />}
							</div>
						)
					})}
					<Divider style={{ margin: "4px 0 4px 0" }} />
					<div
						className="trigger-date-picker"
						onClick={(e) => {
							setDataTimeOpen(true)
							e.stopPropagation()
						}}
					>
						<div
							className={`dropdown-item nodrag ${
								val?.[0] === "designation" ? "ant-select-item-option-selected" : ""
							}`}
						>
							<div className="label">
								{i18next.t("common.targetDate", { ns: "magicFlow" })}
							</div>
							{val?.[0] === "designation" && <TSIcon type="ts-check-line" />}
						</div>
						<div className="datetime-container" ref={popupContainerRef} />
					</div>
				</div>

				<div className="datetime-wrap">
					<TsDatePicker
						getPopupContainer={() => popupContainerRef.current as HTMLDivElement}
						format={placeholder}
						showTime={showTime}
						showNow={false}
						open={dataTimeOpen}
						onOpenChange={(o) => !o && setDataTimeOpen(false)}
						onChange={(date) => handleExactDate(date)}
						onOk={(date) => {
							handleExactDate(date)
							selectRef.current.blur()
						}}
					/>
				</div>
			</div>
		</div>
	)
}

export default TimeSelect
