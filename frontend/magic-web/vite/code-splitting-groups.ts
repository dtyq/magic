import { resolve } from "node:path"

/** Rolldown manual chunk groups for production code splitting. */
function normalizeModuleId(id: string): string {
	return id.replace(/\\/g, "/")
}

function getModulePath(id: string): string {
	return normalizeModuleId(id).split("?", 1)[0]
}

function hasQuery(id: string, query: string): boolean {
	return normalizeModuleId(id).split("?", 2)[1]?.split("&").includes(query) ?? false
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isLocaleModule(id: string, locale: "zh_CN" | "en_US", projectRoot: string): boolean {
	// Vite/Rolldown may append query parameters to transformed module ids.
	const normalizedId = normalizeModuleId(id).split("?", 1)[0]
	const normalizedProjectRoot = normalizeModuleId(resolve(projectRoot))

	// Restrict app locale matching to the configured magic-web source roots. A
	// generic `/src/assets/locales/` match would capture unrelated packages that
	// happen to use the same directory convention.
	const appLocalePath = new RegExp(
		`^${escapeRegExp(normalizedProjectRoot)}/(?:src|enterprise/src|customer/src)/assets/locales/${locale}/.+\\.json$`,
	)
	if (appLocalePath.test(normalizedId)) {
		return true
	}

	// Both admin packages are compiled from source inside the magic-web build
	// (alias @magic-admin-v2, and vite-plugin-magic-admin-source), so their
	// namespace JSONs land in the same chunk graph. Keep them with the matching
	// application language chunk. Anchored on each package root so `dist/`
	// build output — which only copies locales verbatim — stays out of the app
	// chunks.
	//
	// - magic-admin:     <pkg>/src|enterprise|customer/locales/<locale>/*.json
	// - magic-admin-v2:  <pkg>/src/i18n/messages/<layer>/<locale>/*.json
	const adminLocalePath = new RegExp(
		`^${escapeRegExp(normalizedProjectRoot)}/packages/(?:magic-admin|magic-admin-v2)/(?:src|enterprise/src|customer/src)/(?:locales|assets/locales|i18n/messages/(?:base|edition|development-base|development-edition))/${locale}/.+\\.json$`,
	)
	if (adminLocalePath.test(normalizedId)) {
		return true
	}

	// Ant Design imports its locale through a small tree of antd, rc-pagination,
	// and rc-picker locale modules. Keep those dependencies with the app locale
	// chunk so the dynamic antd/locale import does not recreate locale fragments.
	const antdLocalePath = new RegExp(
		`/node_modules/(?:antd|rc-pagination|rc-picker)/(?:es|lib)/(?:[^/]+/)*locale/${locale}(?:\\.js|\\.mjs)?$`,
	)
	if (antdLocalePath.test(normalizedId)) {
		return true
	}

	// magic-flow exposes its i18next resource as one JSON namespace per
	// language. Keep it with the corresponding application language chunk.
	const magicFlowLocalePath = new RegExp(
		`/node_modules/@dtyq/magic-flow/dist/common/locales/${locale}/.+\\.json$`,
	)
	if (magicFlowLocalePath.test(normalizedId)) {
		return true
	}

	// Day.js uses lowercase locale identifiers instead of the app's region form.
	const dayjsLocale = locale === "zh_CN" ? "zh-cn" : "en"
	return new RegExp(`/node_modules/dayjs/locale/${dayjsLocale}\\.js$`).test(normalizedId)
}

export function createCodeSplittingGroups(projectRoot = process.cwd()) {
	return [
		{
			name: "locale-zh-cn",
			priority: 100,
			entriesAware: false,
			test: (id: string) => isLocaleModule(id, "zh_CN", projectRoot),
		},
		{
			name: "locale-en-us",
			priority: 100,
			entriesAware: false,
			test: (id: string) => isLocaleModule(id, "en_US", projectRoot),
		},
		{
			name: "antd-colors",
			priority: 40,
			test: (id: string) => normalizeModuleId(id).includes("node_modules/@ant-design/colors"),
		},
		{
			name: "lucide-icons-static",
			priority: 40,
			entriesAware: false,
			test: (id: string) => {
				const modulePath = getModulePath(id)
				if (!modulePath.includes("node_modules/lucide-react/dist/esm/")) return false
				if (hasQuery(id, "lucide-dynamic")) return false

				return (
					hasQuery(id, "lucide-static") ||
					modulePath.includes("/createLucideIcon.js") ||
					modulePath.includes("/Icon.js") ||
					modulePath.includes("/defaultAttributes.js") ||
					modulePath.includes("/shared/src/")
				)
			},
		},
		{
			name: "lucide-icons-dynamic",
			priority: 30,
			entriesAware: false,
			test: (id: string) => {
				const modulePath = getModulePath(id)
				if (!modulePath.includes("node_modules/lucide-react/dist/esm/")) return false
				if (hasQuery(id, "lucide-static")) return false

				return (
					hasQuery(id, "lucide-dynamic") ||
					modulePath.includes("/dynamicIconImports.js") ||
					modulePath.includes("/DynamicIcon.js")
				)
			},
		},
		{
			name: "ahooks",
			priority: 30,
			test: (id: string) => normalizeModuleId(id).includes("node_modules/ahooks"),
		},
		{
			name: "shadcn-ui",
			priority: 20,
			test: (id: string) => normalizeModuleId(id).includes("src/components/shadcn-ui"),
		},
		{
			name: "mermaid-loader",
			priority: 30,
			test: (id: string) => normalizeModuleId(id).includes("/src/library/mermaid/"),
		},
		{
			name: "monacoEditorReact",
			priority: 20,
			test: (id: string) =>
				normalizeModuleId(id).includes("node_modules/@monaco-editor/react"),
		},
		{
			name: "monacoEditor",
			priority: 10,
			test: (id: string) => {
				const normalizedId = normalizeModuleId(id)

				return (
					normalizedId.includes("node_modules/monaco-editor") &&
					!normalizedId.includes("node_modules/@monaco-editor/react")
				)
			},
		},
		{
			name: "mention-panel-default-runtime",
			priority: 10,
			test: (id: string) =>
				normalizeModuleId(id).includes(
					"src/components/business/MentionPanel/runtime/default-runtime",
				),
		},
		{
			name: "tabler-icons-used",
			priority: 100,
			test: (id: string) =>
				normalizeModuleId(id).includes("node_modules/@tabler/icons-react/dist/esm/"),
		},
		{
			name: "tabler-icons-custom",
			priority: 100,
			entriesAware: false,
			test: (id: string) =>
				normalizeModuleId(id).includes("/src/enhance/tabler/icons-react/"),
		},
	]
}
