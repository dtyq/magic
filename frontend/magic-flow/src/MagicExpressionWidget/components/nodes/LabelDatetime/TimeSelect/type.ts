import { DefaultOptionType } from "antd/lib/select"

export enum TimeSelectType {
	Yesterday = 'yesterday',
	Today = 'today',
	Tomorrow = 'tomorrow',
	TriggerTime = 'trigger_time',
	Designation = 'designation'
}

export type TimeSelectValue = {
	type: TimeSelectType
	value: string
}

export type TimeSelectProps = {
	value: TimeSelectValue | null
	options?: {id: string; label: string}[]
	placeholder?: string
	onChange: (val: TimeSelectValue | null) => void 
}