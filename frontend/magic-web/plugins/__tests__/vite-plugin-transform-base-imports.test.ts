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

	const result = plugin.transform.call(
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
})
