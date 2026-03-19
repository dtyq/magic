import { useEventEmitter, useMemoizedFn } from "ahooks"
import { isEmpty, set, cloneDeep } from "lodash-es"
import { forwardRef, useImperativeHandle, useMemo, useState } from "react"
import { nanoid } from "nanoid"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import type { Widget } from "@/types/flow"
import ArgsSettings from "./ArgsSettings"
import PostAddrSettings from "./PostAddrSettings"
import { ArgsTabType, type ApiSettingsInstance, type ApiSettingsProps } from "./types"

const ApiSettings = forwardRef<ApiSettingsInstance, ApiSettingsProps>((componentProps, ref) => {
	const { apiSettings, setApiSettings, ...props } = componentProps
	const [activeKey, setActiveKey] = useState(ArgsTabType.Query)

	/** uri与path组件联动的事件订阅器 */
	const pathEventEmitter = useEventEmitter<string[]>()

	const getConfig = useMemoizedFn((config: any) => {
		const isNull = isEmpty(config) || JSON.stringify(config) === "{}"
		if (isNull)
			return {
				id: nanoid(8),
				type: "form",
				version: "1",
				structure: null,
			}
		return config
	})

	const settingsValue = useMemo(() => {
		return {
			params_query: getConfig(
				apiSettings?.structure?.request?.params_query,
			) as Widget<Schema>,
			params_path: getConfig(apiSettings?.structure?.request.params_path) as Widget<Schema>,
			body_type: apiSettings?.structure?.request?.body_type as string,
			body: getConfig(apiSettings?.structure?.request?.body) as Widget<Schema>,
			headers: getConfig(apiSettings?.structure?.request?.headers) as Widget<Schema>,
			domain: apiSettings?.structure?.domain as string,
			path: apiSettings?.structure?.path as string,
			method: apiSettings?.structure?.method as string,
			url: apiSettings?.structure?.url as string,
		}
	}, [
		getConfig,
		apiSettings?.structure?.request?.params_query,
		apiSettings?.structure?.request.params_path,
		apiSettings?.structure?.request?.body_type,
		apiSettings?.structure?.request?.body,
		apiSettings?.structure?.request?.headers,
		apiSettings?.structure?.domain,
		apiSettings?.structure?.path,
		apiSettings?.structure?.method,
		apiSettings?.structure?.url,
	])

	// console.log("settingsValue", settingsValue)

	const onSettingsChange = useMemoizedFn((changePath: string[], val: any) => {
		if (!apiSettings) return
		// 是form组件的key列表
		const formKeys = ["params_query", "params_path", "headers", "body"]
		const lastKey = changePath[changePath.length - 1]
		const traceKeys = ["structure", ...changePath]
		// 如果不是body类型，则是form组件，需要将值设置到structure
		if (formKeys.includes(lastKey)) {
			traceKeys.push("structure")
		}
		set(apiSettings, traceKeys, val)
		setApiSettings?.({ ...apiSettings })
	})

	/** 更新函数，给子组件使用，有时候切换tab需要数据最新数据 */
	const update = useMemoizedFn(() => {
		if (!apiSettings || !setApiSettings) return
		setApiSettings({ ...apiSettings })
	})

	useImperativeHandle(ref, () => ({
		getValue() {
			return apiSettings!
		},
		setValue(changePath: string[], val: any, activeKeyArg?: ArgsTabType) {
			if (!apiSettings || !setApiSettings) return
			if (activeKeyArg) setActiveKey(activeKeyArg)
			set(apiSettings, changePath, cloneDeep(val))
			setApiSettings({ ...apiSettings })
		},
	}))

	const argsSettingsPaths = useMemo(
		() => ({
			query: ["request", "params_query"],
			path: ["request", "params_path"],
			bodyType: ["request", "body_type"],
			body: ["request", "body"],
			headers: ["request", "headers"],
		}),
		[],
	)

	const postAddrPaths = useMemo(
		() => ({
			method: ["method"],
			url: ["url"],
			domain: ["domain"],
		}),
		[],
	)

	return (
		<div>
			<PostAddrSettings
				value={settingsValue}
				onChange={onSettingsChange}
				paths={postAddrPaths}
				pathEventEmitter={pathEventEmitter}
				{...props}
			/>
			<ArgsSettings
				onChange={onSettingsChange}
				value={settingsValue}
				paths={argsSettingsPaths}
				activeKey={activeKey}
				pathEventEmitter={pathEventEmitter}
				update={update}
				{...props}
			/>
		</div>
	)
})

export default ApiSettings
