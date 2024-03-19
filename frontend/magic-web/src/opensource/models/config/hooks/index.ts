import { useMemo, useEffect, useState } from "react"
import { reaction } from "mobx"
import { normalizeLocale } from "@/opensource/utils/locale"
import { useTranslation } from "react-i18next"
import { magic } from "@/opensource/enhance/magicElectron"
import { service } from "@/opensource/services"
import type { ConfigService } from "@/opensource/services/config/ConfigService"
import { configStore } from "../stores"

/**
 * 获取全局语言
 * @param includeAuto 是否包含自动
 */
export function useGlobalLanguage<T>(includeAuto: T = true as T) {
	const [language, setLanguage] = useState(configStore.i18n.language)

	useEffect(() => {
		return reaction(
			() => configStore.i18n.language,
			(newLanguage) => setLanguage(newLanguage),
		)
	}, [])

	if (includeAuto) return language
	return language === "auto" ? normalizeLocale(window.navigator.language) : language
}

/**
 * 获取全局列表
 * @param includeAuto 是否包含自动
 */
export function useSupportLanguageOptions(includeAuto = true) {
	const { t } = useTranslation("interface")
	const [state, setState] = useState({
		language: configStore.i18n.language,
		languages: configStore.i18n.languages,
	})

	useEffect(() => {
		return reaction(
			() => ({
				language: configStore.i18n.language,
				languages: configStore.i18n.languages,
			}),
			(newState) => setState(newState),
		)
	}, [])

	return useMemo(() => {
		return state.languages.reduce<
			Array<{ label: string; value: string; translations?: Record<string, string> }>
		>(
			(array, lang) => {
				array.push({
					label: lang.translations?.[lang.locale] || lang.name,
					value: lang.locale,
					translations: lang.translations,
				})
				return array
			},
			includeAuto ? [{ label: t("setting.languages.auto"), value: "auto" }] : [],
		)
	}, [includeAuto, state.languages, t])
}

/**
 * @description 设置全局国际化语言
 * @param lang
 */
export function setGlobalLanguage(lang: string) {
	magic?.language?.setLanguage?.(lang)
	service.get<ConfigService>("configService").setLanguage(lang)
}

/**
 * @description 获取当前访问集群配置
 */
export function useClusterConfig() {
	const [clusterConfig, setClusterConfig] = useState(configStore.cluster.cluster)
	const [clustersConfig, setClustersConfig] = useState(configStore.cluster.clusterConfig)

	useEffect(() => {
		const disposer = reaction(
			() => configStore.cluster.cluster,
			(config) => setClusterConfig(config),
			{ fireImmediately: true },
		)

		return () => disposer()
	}, [])

	useEffect(() => {
		const disposer = reaction(
			() => configStore.cluster.clusterConfig,
			(config) => setClustersConfig(config),
		)

		return () => disposer()
	}, [])

	return { clusterConfig, clustersConfig }
}

export function useTheme() {
	const [themeConfig, setThemeConfig] = useState(configStore.theme.theme)

	useEffect(() => {
		return reaction(
			() => configStore.theme.theme,
			(theme) => setThemeConfig(theme),
		)
	}, [])

	const prefersColorScheme = useMemo(() => {
		if (themeConfig === "auto") {
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
		return themeConfig
	}, [themeConfig])

	return {
		theme: themeConfig,
		setTheme: service.get<ConfigService>("configService").setThemeConfig,
		prefersColorScheme,
	}
}

export function useFontScale() {
	const [fontScale, setFontScaleState] = useState(configStore.font.fontScale)

	useEffect(() => {
		return reaction(
			() => configStore.font.fontScale,
			(scale) => setFontScaleState(scale),
		)
	}, [])

	return {
		fontScale,
		setFontScale: service.get<ConfigService>("configService").setFontScaleConfig,
	}
}

export function useAreaCodes() {
	const [areaCodes, setAreaCodes] = useState(configStore.i18n.areaCodes)

	useEffect(() => {
		return reaction(
			() => configStore.i18n.areaCodes,
			(config) => setAreaCodes(config),
		)
	}, [])

	return { areaCodes }
}
