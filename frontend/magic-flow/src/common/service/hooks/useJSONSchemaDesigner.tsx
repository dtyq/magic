import { Common } from "@/MagicConditionEdit/types/common"
import { useMemoizedFn } from "ahooks"
import type { AxiosPromise } from "axios"
import { RequestInstance } from ".."

export type JSONSchemaDesignerServiceType = {
	getDynamicObject: () => AxiosPromise<any>
	getDynamicOptions: () => AxiosPromise<any>
	getOptionsDynamicDefault: () => AxiosPromise<Common.API_SETTINGS>
	getObjectDynamicDefault: () => AxiosPromise<Common.API_SETTINGS>
}

export default ({ request }: { request: RequestInstance }) => {
	/**
	 * @description 获取object类型的动态字段数据源
	 */
	const getDynamicObject = useMemoizedFn(() => {
		return request({
			url: "/v1/object-template",
			method: "POST",
		})
	})

	/**
	 * @description 获取string类型的动态字段数据源
	 */
	const getDynamicOptions = useMemoizedFn(() => {
		return request({
			url: "/v1/options-template",
			method: "POST",
		})
	})

	// 获取动态字段创建模板 options
	const getOptionsDynamicDefault = useMemoizedFn(() => {
		return request({
			url: "/v1/dynamic-fields-options-api-template",
			method: "POST",
		})
	})

	// 获取动态字段创建模板 objects
	const getObjectDynamicDefault = useMemoizedFn(() => {
		return request({
			url: "/v1/dynamic-fields-objects-api-template",
			method: "POST",
		})
	})

	return {
		getDynamicObject,
		getDynamicOptions,
		getOptionsDynamicDefault,
		getObjectDynamicDefault,
	}
}
