import path from "node:path"
import { mergeConfig, type Plugin, type UserConfig } from "vite"
import vitePluginHtmlOverlay, { createHtmlOverlayPlan } from "./html"
import { createPublicOverlayPlan } from "./public"
import vitePluginSrcOverlay, { type SrcOverlayLayerOption } from "./src"

export interface VitePluginOverlayLayerOption {
	name: string
	rootPath: string
	sourceDir?: string
	alias?: string | false
	reloadOnChange?: boolean
	publicDir?: string | false
}

export interface VitePluginOverlayOptions {
	projectRoot: string
	layers: VitePluginOverlayLayerOption[]
	profileEnvName?: string
}

interface SourceOverlayLayer extends SrcOverlayLayerOption {
	alias?: string | false
	sourcePath: string
}

export default function vitePluginOverlay({
	projectRoot,
	layers,
	profileEnvName,
}: VitePluginOverlayOptions): Plugin[] {
	const sourceLayers = createSourceOverlayLayers({ projectRoot, layers })
	const htmlPlan = createHtmlOverlayPlan({ projectRoot, layers })
	const publicPlan = createPublicOverlayPlan({ projectRoot, layers })
	const generatedConfig = [
		createSourceOverlayConfig(sourceLayers),
		htmlPlan.config,
		publicPlan.config,
	].reduce<UserConfig>((acc, partial) => mergeConfig(acc, partial), {})

	const plugins: Plugin[] = [
		{
			name: "vite-plugin-overlay:config",
			enforce: "pre",
			config() {
				return generatedConfig
			},
		},
	]

	if (sourceLayers.length > 1) {
		plugins.push(
			vitePluginSrcOverlay({
				projectRoot,
				layers: sourceLayers,
				profileEnvName,
			}),
		)
	}

	if (htmlPlan.htmlEntryNames.size > 0) {
		plugins.push(
			vitePluginHtmlOverlay({
				htmlOverrides: htmlPlan.htmlOverrides,
				htmlEntryNames: htmlPlan.htmlEntryNames,
			}),
		)
	}

	plugins.push(...publicPlan.plugins)

	return plugins
}

function createSourceOverlayLayers({
	projectRoot,
	layers,
}: {
	projectRoot: string
	layers: VitePluginOverlayLayerOption[]
}): SourceOverlayLayer[] {
	return layers
		.filter((layer) => layer.sourceDir)
		.map((layer) => {
			const sourcePath = path.resolve(layer.rootPath, layer.sourceDir!)
			return {
				name: layer.name,
				dir: path.relative(projectRoot, sourcePath),
				alias: layer.alias,
				reloadOnChange: layer.reloadOnChange,
				sourcePath,
			}
		})
}

function createSourceOverlayConfig(sourceLayers: SourceOverlayLayer[]): UserConfig {
	if (sourceLayers.length <= 1) return {}

	return {
		resolve: {
			// Array form keeps overlay aliases additive with the app's base aliases.
			alias: sourceLayers
				.filter((layer) => layer.alias)
				.map((layer) => ({ find: layer.alias as string, replacement: layer.sourcePath })),
		},
	}
}
