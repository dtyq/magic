import vitePluginTransformBaseImports from "../vite-plugin-transform-base-imports"

function getTransformResult({
	code,
	paths,
}: {
	code: string
	paths: Parameters<typeof vitePluginTransformBaseImports>[0]["paths"]
}) {
	const plugin = vitePluginTransformBaseImports({ paths })
	if (!("transform" in plugin) || !plugin.transform) throw new Error("Transform hook is required")

	// The hook is declared in object form so Rolldown can apply `filter` natively.
	const handler =
		typeof plugin.transform === "function" ? plugin.transform : plugin.transform.handler
	const result = handler.call(
		{
			getCombinedSourcemap: () => null,
		},
		code,
		"/virtual/test.tsx",
	)

	if (!result || typeof result === "string") return result

	return result.code
}

describe("vitePluginTransformBaseImports", () => {
	test("transforms base component named imports to default imports", () => {
		const code = 'import { FlexBox, MagicButton as Button } from "@/components/base"'

		const transformedCode = getTransformResult({
			code,
			paths: ["@/components/base"],
		})

		expect(transformedCode).toContain('import FlexBox from "@/components/base/FlexBox"')
		expect(transformedCode).toContain('import Button from "@/components/base/MagicButton"')
	})

	test("transforms lucide-react named imports to deep icon imports", () => {
		const code = 'import { CircleCheckIcon, Loader2Icon, TriangleAlert } from "lucide-react"'

		const transformedCode = getTransformResult({
			code,
			paths: [
				{
					base: "lucide-react",
					subDirectory: "dist/esm/icons",
					componentNameFormatter: (componentName) =>
						`${componentName
							.replace(/Icon$/, "")
							.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
							.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
							.replace(/([a-zA-Z])(\d)/g, "$1-$2")
							.replace(/(\d)([a-zA-Z])/g, "$1-$2")
							.toLowerCase()}.js`,
				},
			],
		})

		expect(transformedCode).toContain(
			'import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check.js"',
		)
		expect(transformedCode).toContain(
			'import Loader2Icon from "lucide-react/dist/esm/icons/loader-2.js"',
		)
		expect(transformedCode).toContain(
			'import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert.js"',
		)
	})

	test("transforms multiline lucide-react imports to deep icon imports", () => {
		const code = `import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react"`

		const transformedCode = getTransformResult({
			code,
			paths: [
				{
					base: "lucide-react",
					subDirectory: "dist/esm/icons",
					componentNameFormatter: (componentName) =>
						`${componentName
							.replace(/Icon$/, "")
							.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
							.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
							.replace(/([a-zA-Z])(\d)/g, "$1-$2")
							.replace(/(\d)([a-zA-Z])/g, "$1-$2")
							.toLowerCase()}.js`,
				},
			],
		})

		expect(transformedCode).toContain(
			'import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check.js"',
		)
		expect(transformedCode).toContain(
			'import InfoIcon from "lucide-react/dist/esm/icons/info.js"',
		)
		expect(transformedCode).toContain(
			'import Loader2Icon from "lucide-react/dist/esm/icons/loader-2.js"',
		)
		expect(transformedCode).toContain(
			'import OctagonXIcon from "lucide-react/dist/esm/icons/octagon-x.js"',
		)
		expect(transformedCode).toContain(
			'import TriangleAlertIcon from "lucide-react/dist/esm/icons/triangle-alert.js"',
		)
	})

	test("marks transformed Lucide static imports for the static code-splitting group", () => {
		const transformedCode = getTransformResult({
			code: 'import { Search } from "lucide-react"',
			paths: [
				{
					base: "lucide-react",
					subDirectory: "dist/esm/icons",
					query: "lucide-static",
					componentNameFormatter: (componentName) => `${componentName.toLowerCase()}.js`,
				},
			],
		})

		expect(transformedCode).toContain(
			'import Search from "lucide-react/dist/esm/icons/search.js?lucide-static"',
		)
	})

	test("native filter only admits script modules outside node_modules that quote a base", () => {
		const plugin = vitePluginTransformBaseImports({
			paths: ["@/components/base", { base: "lucide-react", subDirectory: "dist/esm/icons" }],
		})
		const { filter } = plugin.transform as unknown as {
			filter: { id: { include: RegExp; exclude: RegExp }; code: RegExp }
		}

		expect(filter.id.include.test("/src/a.tsx")).toBe(true)
		expect(filter.id.include.test("/src/a.css")).toBe(false)
		expect(filter.id.exclude.test("/x/node_modules/a.js")).toBe(true)
		expect(filter.code.test('import { A } from "@/components/base"')).toBe(true)
		expect(filter.code.test("import { A } from 'lucide-react'")).toBe(true)
		expect(filter.code.test('import { A } from "@/components/base/Other"')).toBe(false)
		expect(filter.code.test("const x = 1")).toBe(false)
	})
})
