import { createContext, useContext, useMemo, useCallback, useState } from "react"
import type { ComponentType, PropsWithChildren } from "react"
import { Radio } from "antd"
import MagicDatePicker from "../MagicDatePicker"
import MagicInput from "../MagicInput"
import MagicSelect from "../MagicSelect"
import MagicTreeSelect from "../MagicTreeSelect"
import { SearchItemType } from "./types"

// 搜索组件类型定义
export interface SearchComponent {
	component: ComponentType<any>
	props?: Record<string, any>
}

// 默认搜索基础组件
const defaultComponents = new Map<string, SearchComponent>([
	[SearchItemType.TEXT, { component: MagicInput }],
	[SearchItemType.SELECT, { component: MagicSelect }],
	[SearchItemType.TREE_SELECT, { component: MagicTreeSelect }],
	[SearchItemType.DATE_RANGE, { component: MagicDatePicker.RangePicker }],
	[SearchItemType.DATE, { component: MagicDatePicker }],
	[SearchItemType.RADIO, { component: Radio }],
	[SearchItemType.RADIO_GROUP, { component: Radio.Group }],
])

const SearchComponentContext = createContext<{
	components: Map<string, SearchComponent>
	register: (type: string, component: SearchComponent) => void
	getComponent: (type: string) => ComponentType<any> | null
}>({
	components: new Map(),
	register: () => {},
	getComponent: () => null,
})

// Provider组件
export const SearchComponentProvider = ({ children }: PropsWithChildren) => {
	// 使用useMemo缓存组件Map
	const [components, setComponents] = useState<Map<string, SearchComponent>>(
		new Map(defaultComponents),
	)

	// 注册组件
	const register = useCallback((type: string, component: SearchComponent) => {
		setComponents((prev) => {
			const newMap = new Map(prev)
			newMap.set(type, component)
			return newMap
		})
	}, [])

	// 获取组件
	const getComponent = useCallback(
		(type: string) => {
			const componentConfig = components.get(type)
			return componentConfig?.component || null
		},
		[components],
	)

	// 使用useMemo缓存context值
	const contextValue = useMemo(
		() => ({
			components,
			register,
			getComponent,
		}),
		[components, register, getComponent],
	)

	return (
		<SearchComponentContext.Provider value={contextValue}>
			{children}
		</SearchComponentContext.Provider>
	)
}

// Hook
export const useSearchComponents = () => {
	const context = useContext(SearchComponentContext)
	if (!context) {
		throw new Error("useSearchComponents must be used within SearchComponentProvider")
	}
	return context
}

// 注册搜索组件
export const useRegisterSearchComponent = () => {
	const { register } = useSearchComponents()

	return useCallback(
		(type: string, component: SearchComponent) => {
			register(type, component)
		},
		[register],
	)
}
