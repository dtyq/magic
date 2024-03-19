import externalGlobals, { type ModuleNameMap } from "rollup-plugin-external-globals"
import { viteExternalsPlugin } from "vite-plugin-externals"
import fs from "fs"
import path from "path"
import type { HtmlTagDescriptor, Plugin, UserConfig } from "vite"
import { Module, Options } from "./types"

const isDev = process.env.NODE_ENV === "development"

/**
 * get npm module version
 * @param name
 * @returns
 */
function getModuleVersion(name: string): string {
	const pwd = process.cwd()
	const pkgFile = path.join(pwd, "node_modules", name, "package.json")
	if (fs.existsSync(pkgFile)) {
		const pkgJson = JSON.parse(fs.readFileSync(pkgFile, "utf8"))
		return pkgJson.version
	}

	return ""
}

function renderUrl(
	url: string,
	data: {
		name: string
		version: string
		path: string
	},
) {
	const { path } = data
	url = path
	return url
		.replace(/\{name\}/g, data.name)
		.replace(/\{version\}/g, data.version)
		.replace(/\{path\}/g, path)
}

function getModuleInfo(module: Module, prodUrl: string) {
	prodUrl = module.prodUrl || prodUrl
	let v = module
	const version = getModuleVersion(v.name)
	let pathList: string[] = []
	if (!Array.isArray(v.path)) {
		pathList.push(v.path)
	} else {
		pathList = v.path
	}

	const data = {
		...v,
		version,
	}

	pathList = pathList.map((p) => {
		return renderUrl(prodUrl, {
			...data,
			path: p,
		})
	})

	let css = v.css || []
	if (!Array.isArray(css) && css) {
		css = [css]
	}

	const cssList = !Array.isArray(css)
		? []
		: css.map((c) =>
				renderUrl(prodUrl, {
					...data,
					path: c,
				}),
		  )

	return {
		...v,
		version,
		pathList,
		cssList,
	}
}

function PluginImportToCDN(options: Options): Plugin[] {
	const {
		modules = [],
		prodUrl = "https://cdn.jsdelivr.net/npm/{name}@{version}/{path}",
		enableInDevMode = false,
		generateCssLinkTag,
		generateScriptTag,
	} = options

	let isBuild = false

	const data = modules
		.map((m) => {
			const list = (Array.isArray(m) ? m : [m]).map((v) =>
				typeof v === "function" ? v(prodUrl) : v,
			)
			return list.map((v) => getModuleInfo(v, prodUrl))
		})
		.flat()

	const externalMap: ModuleNameMap = {}

	data.forEach((v) => {
		externalMap[v.name] = v.var
		if (Array.isArray(v.alias)) {
			v.alias.forEach((alias) => {
				externalMap[alias] = v.var
			})
		}
	})

	const plugins: Plugin[] = [
		{
			name: "vite-plugin-cdn-import",
			enforce: "pre",
			config(_, { command }) {
				isBuild = command === "build"

				const userConfig: UserConfig = {
					build: {
						rollupOptions: {
							plugins: [],
						},
					},
				}

				if (isBuild) {
					userConfig.build!.rollupOptions!.plugins = [externalGlobals(externalMap) as Plugin]
				}

				return userConfig
			},
			transformIndexHtml(html) {
				if (!isBuild && !enableInDevMode) {
					return html
				}

				const descriptors: HtmlTagDescriptor[] = []

				type CustomHtmlTagDescriptor = Omit<HtmlTagDescriptor, "tag" | "children">

				data.forEach((v) => {
					v.pathList.forEach((url) => {
						const cusomize = generateScriptTag?.(v.name, url) || {}
						const attrs = {
							src: url,
							crossorigin: "anonymous",
							...cusomize.attrs,
						}

						descriptors.push({
							tag: "script",
							...cusomize,
							attrs,
						})
					})
					v.cssList.forEach((url) => {
						const cusomize = generateCssLinkTag?.(v.name, url) || {}
						const attrs = {
							href: url,
							rel: "stylesheet",
							crossorigin: "anonymous",
							...cusomize.attrs,
						}
						descriptors.push({
							tag: "link",
							...cusomize,
							attrs,
						})
					})
				})

				return descriptors
			},
		},
	]

	if (isDev && enableInDevMode) {
		plugins.push(
			viteExternalsPlugin(externalMap, {
				enforce: "pre",
			}),
		)
	}

	return plugins
}

/**
 * @deprecated Pass the package name directly in options.modules instead.
 */
export { PluginImportToCDN as Plugin, Options }

export default PluginImportToCDN
