import TsInput from "@/common/BaseUI/Input"
import { InputRef } from "antd"
import React, { ReactElement, ReactNode, useEffect, useRef, useState } from "react"

interface FieldInputProp {
	value: string
	addonAfter?: ReactNode
	onChange: (e: any, value: string) => boolean
	disabled?: boolean
}

const FieldInput = (props: FieldInputProp): ReactElement => {
	const [fieldValue, setFieldValue] = useState<string>(props.value)
	const [status, setStatus] = useState<"" | "warning" | "error">("")
	const [placeholder, setPlaceholder] = useState<string>()
	const ref = useRef<InputRef>(null)

	useEffect(() => {
		setFieldValue(props.value)
	}, [props.value])

	const handleChange = (e: any, value: any) => {
		setPlaceholder("")
		setStatus("")
		if (placeholder === value) {
			setFieldValue(value)
			return
		}
		if (props.onChange(e, value) && value) {
			setFieldValue(value)
		}
	}

	return (
		<TsInput
			ref={ref}
			status={status}
			addonAfter={props.addonAfter}
			value={fieldValue}
			placeholder={placeholder}
			onChange={(ele: any) => handleChange(ele, ele.target.value)}
			disabled={props.disabled}
		/>
	)
}

export default FieldInput
