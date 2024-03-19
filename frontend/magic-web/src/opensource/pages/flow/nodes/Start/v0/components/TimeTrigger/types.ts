import type { CycleTypeMap, Units } from "./constants"

export type TimeTriggerParams = {
	type: CycleTypeMap
	day: string // 1~31
	time: string
	// 自定义重复时设置
	value: {
		interval: number
		unit: Units
		values: number[]
		deadline: null | string
	}
}
export default {}
