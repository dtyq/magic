type ResourceLoader = () => Promise<unknown>

interface LocaleModules {
	zhCNModules: Record<string, ResourceLoader>
	enUSModules: Record<string, ResourceLoader>
}

interface AdminLocaleModules {
	adminZhCNModules: Record<string, ResourceLoader>
	adminEnUSModules: Record<string, ResourceLoader>
}

export function getLocaleModules(): LocaleModules {
	return {
		zhCNModules: import.meta.glob("./zh_CN/**/*.json"),
		enUSModules: import.meta.glob("./en_US/**/*.json"),
	}
}

export function getAdminLocaleModules(): AdminLocaleModules {
	return {
		adminZhCNModules: import.meta.glob(
			"../../../packages/magic-admin/src/locales/zh_CN/**/*.json",
		),
		adminEnUSModules: import.meta.glob(
			"../../../packages/magic-admin/src/locales/en_US/**/*.json",
		),
	}
}

export function loadMagicFlowLocale(normalizedLng: string, namespace: string) {
	return import(
		`../../../node_modules/@dtyq/magic-flow/dist/common/locales/${normalizedLng}/${namespace}.json`
	)
}

export function loadFallbackLocale(normalizedLng: string, namespace: string) {
	return import(`./${normalizedLng}/${namespace}.json`)
}
