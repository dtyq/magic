import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { platformKey } from "@/common/utils/storage"

/** 全局国际化语言选项 */
interface GlobalLanguageOption {
	/** 当前语言标识 */
	locale: string
	/** 当前语言名称 */
	name: string
	/** 用于当前语言的枚举各语言的表达 */
	translations: Record<string, string>
}

/** 全局国际冠号选项 */
interface AreaCodeOption {
	/** 当前语言标识 */
	locale: string
	/** 当前冠号识别号 */
	code: string
	/** 当前语言名称 */
	name: string
	/** 用于当前语言的枚举各语言的表达 */
	translations: Record<string, string>
}

/** 全局语言模块 */
export interface GlobalLanguage {
	/** 当前语言 */
	language: string
	/** 本地语言列表 */
	languages: Array<GlobalLanguageOption>
	/** 设置当前语言 */
	setLanguage: (language: string) => void
	/** 设置语言列表 */
	setLanguages: (languages: Array<GlobalLanguageOption>) => void
	/** 国际冠号(电话号码地区识别号) */
	areaCodes: Array<AreaCodeOption>
	setAreaCodes: (areaCodes: Array<AreaCodeOption>) => void
	/** 获取全局国际化配置 */
	// useFetchOptions: () => void
	/** 国际化语言实例 */
	// instance: i18n
}

// 显式声明store类型
export type GlobalLanguageStoreType = ReturnType<typeof createStore>

// 创建store函数
const createStore = () => {
	return create<GlobalLanguage>()(
		persist(
			(set) => ({
				language: "en_US",
				languages: [],
				areaCodes: [],
				setLanguage: (language) => {
					set({ language })
				},
				setLanguages: (languages) => {
					set({
						languages: languages.map((lang) => ({
							name: lang.name,
							locale: lang.locale,
							translations: lang?.translations,
						})),
					})
				},
				setAreaCodes: (areaCodes) => {
					set({
						areaCodes: areaCodes.map((item) => ({
							name: item.name,
							code: item.code,
							locale: item.locale,
							translations: item?.translations,
						})),
					})
				},
			}),
			{
				name: platformKey("store:internationalized"),
				partialize: (state) => ({
					language: state.language,
					languages: state.languages,
					areaCodes: state.areaCodes,
				}),
				storage: createJSONStorage(() => localStorage),
			}
		)
	)
}

// 创建并导出store实例
export const store = createStore()
