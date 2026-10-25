import { defineConfig, mergeConfig } from "vitest/config"
import appConfig from "./vitest.config"

const html = "src/pages/superMagic/components/Detail/contents/HTML"

// Keep the contract gate scoped to iframe APIs, host routing and injected
// scripts. Ordinary editor/PPT feature tests remain in their existing suites.
export default mergeConfig(
	appConfig,
	defineConfig({
		test: {
			include: [
				`${html}/__tests__/IsolatedHTMLRenderer*.test.tsx`,
				`${html}/__tests__/index.test.tsx`,
				"src/pages/superMagic/hooks/__tests__/useFileData.test.ts",
				`${html}/hooks/__tests__/useHtmlPreviewFreshness.test.ts`,
				`${html}/hooks/__tests__/usePreviewDocumentRevision.test.ts`,
				`${html}/components/__tests__/HtmlPreviewFreshness.test.tsx`,
				"src/pages/superMagic/components/Detail/components/PPTRender/__tests__/PPTSlide.test.tsx",
				`${html}/iframe-api/**/__tests__/*.test.ts`,
				`${html}/iframe-runtime/__tests__/*.test.ts`,
				"plugins/__tests__/vite-plugin-iframe-runtime.test.ts",
				"test/html-sandbox/__tests__/*.test.ts",
				`${html}/utils/__tests__/{fetchInterceptor*,full-content*,virtual-storage*,html-navigation-runtime,html-navigation,location-href-navigation,html-sandbox-runtime-url}.test.ts`,
				"packages/html-sandbox/src/features/__tests__/{MessageProxy*,NetworkInterceptor*,ConsoleProxy*,ApiCallProxy*,StorageInspector*,DevToolsCollector*}.test.ts",
				"packages/html-sandbox/src/runtime/__tests__/{RuntimePlugin,BaseRuntimeBridgeApiPlugin}.test.ts",
				"packages/html-sandbox/src/utils/__tests__/parentOrigin.test.ts",
			],
			maxWorkers: 2,
			coverage: {
				reportsDirectory: "coverage/html-sandbox",
				include: [
					`${html}/iframe-api/magic-api/*.ts`,
					`${html}/iframe-api/hooks/*.ts`,
					"packages/html-sandbox/src/features/{MessageProxy,NetworkInterceptor,ConsoleProxy,ApiCallProxy,StorageInspector,DevToolsCollector}.ts",
				],
			},
		},
	}),
)
