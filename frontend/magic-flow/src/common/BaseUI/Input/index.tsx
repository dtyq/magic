import { Input, InputProps } from "antd"
import { GroupProps, TextAreaProps } from "antd/es/input"
import { SearchProps } from "antd/lib/input"
import React, { forwardRef } from "react"
import { InputGlobalStyle } from "./style"

interface MagicInputProps extends InputProps {}

const MagicInput: any = forwardRef((props: MagicInputProps, ref: any) => {
	return (
		<>
			<InputGlobalStyle />
			<Input {...props} className={`nodrag ${props.className}`} ref={ref} />
		</>
	)
})

MagicInput.TextArea = forwardRef((props: TextAreaProps, ref: any) => (
	<Input.TextArea {...props} className={`${props.className}`} ref={ref} />
))
MagicInput.Search = forwardRef((props: SearchProps, ref: any) => (
	<Input.Search {...props} className={`${props.className}`} ref={ref} />
))
MagicInput.Group = forwardRef((props: GroupProps, ref: any) => (
	<Input.Group {...props} className={`${props.className}`} />
))
MagicInput.Password = forwardRef((props: MagicInputProps, ref: any) => (
	<Input.Password {...props} className={`${props.className}`} ref={ref} />
))

export default MagicInput
