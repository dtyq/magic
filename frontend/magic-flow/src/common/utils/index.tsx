import { Common } from "@/MagicConditionEdit/types/common"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import { ComponentType } from "../constants"

export function toCamelCase(input: string): string {
	return input
		.split("-")
		.map((word) => {
			return word.charAt(0).toUpperCase() + word.slice(1)
		})
		.join("")
}

/**
 * 生成组件默认数据
 * @param componentType
 * @returns
 */
export function genDefaultComponent<ResultType extends Common.ComponentTypes>(
	componentType: ComponentType,
	structure: any = null,
): ResultType {
	const uniqueId = null
	const result = {
		id: uniqueId,
		type: componentType,
		version: "1",
		structure,
	}

	// @ts-ignore
	return result
}

/** 生成Widget组件 */
export function genWidgetComponent(defaultWidget: Common.WidgetSchema | null = null) {
	return genDefaultComponent(ComponentType.Widget, defaultWidget) as Common.WidgetComponent
}

/** 生成表单组件 */
export function genFormComponent(defaultForm: Schema | null = null) {
	return genDefaultComponent(ComponentType.Form, defaultForm) as Common.FormComponent
}

/** 生成条件组件 */
export function genConditionComponent() {
	return genDefaultComponent(ComponentType.Condition) as Common.ConditionComponent
}

/** 生成Api组件 */
export function genApiComponent(defaultWidget: Common.API_SETTINGS | null = null) {
	return genDefaultComponent(ComponentType.Api, defaultWidget) as Common.ApiComponent
}
