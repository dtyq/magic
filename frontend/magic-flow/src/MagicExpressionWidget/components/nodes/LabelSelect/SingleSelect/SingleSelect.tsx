import React from "react"
import MultipleSelect from "../../LabelMultiple/MultipleSelect"
import { MultipleSelectProps } from "../../LabelMultiple/MultipleSelect/Select"

export type SingleSelectProps = MultipleSelectProps

export default function SingleSelect(props: SingleSelectProps) {
	return <MultipleSelect {...props} />
}
