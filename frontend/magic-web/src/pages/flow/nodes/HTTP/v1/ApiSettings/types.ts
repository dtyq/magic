import type { HTTP } from "@/types/flow"
import type { ExpressionSource } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"

/** 参数配置的tab栏类型 */
export enum ArgsTabType {
	Query = "1",
	Body = "2",
	Headers = "3",
}

export interface ApiSettingsProps {
	expressionSource: ExpressionSource
	apiSettings?: HTTP.Api
	setApiSettings?: (value: HTTP.Api) => void
	hasPath?: boolean
}

export interface ApiSettingsInstance {
	// 获取接口组件内部的值
	getValue: () => HTTP.Api
	// 设置接口组件内部的值
	setValue(changePath: string[], val: any, activeKey?: ArgsTabType): void
}

export default {}
