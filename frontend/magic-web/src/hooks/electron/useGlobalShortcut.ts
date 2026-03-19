import { magic } from "@/enhance/magicElectron"
import { useAppearanceStore } from "@/providers/AppearanceProvider/context"
import { useMount } from "ahooks"
import { useCallback } from "react"
import { configStore } from "@/models/config"
import useView from "./useView"

/**
 * @description 结合 electron 对全局的缓存下，暂时只接入快捷键的缓存，后期可扩展为全局的本地存储读写
 */
export default function useGlobalShortcut() {
	const initGlobalShortcut = useCallback(() => {
		magic?.config?.globalShortcut?.getRegisterAll?.().then((globalShortcutConfig) => {
			useAppearanceStore.setState({
				shortcutKey: globalShortcutConfig?.reduce((config, item) => {
					config[item.name] = item.config
					return config
				}, {}),
			})
		})
	}, [])

	const initLocale = useCallback(() => {
		magic?.language?.getLanguage().then((lang) => {
			configStore.i18n.setLanguage(lang)
		})
	}, [])

	useView({
		onShow() {
			console.log("--useGlobalShortcut-- show")
			initLocale()
			initGlobalShortcut()
		},
	})

	useMount(() => {
		initLocale()
		initGlobalShortcut()
	})
}
