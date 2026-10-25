import { describe, expect, it } from "vitest"
import { createCodeSplittingGroups } from "../code-splitting-groups"

function getGroup(name: string) {
	const group = createCodeSplittingGroups("/workspace/frontend/magic-web").find(
		(item) => item.name === name,
	)
	if (!group) throw new Error(`Missing code-splitting group: ${name}`)
	return group
}

describe("locale code-splitting groups", () => {
	it.each([
		["locale-zh-cn", "zh_CN"],
		["locale-en-us", "en_US"],
	] as const)("groups %s locale JSON modules across all overlays", (groupName, locale) => {
		const group = getGroup(groupName)

		expect(group.entriesAware).toBe(false)
		expect(group.priority).toBe(100)
		expect(
			group.test(`/workspace/frontend/magic-web/src/assets/locales/${locale}/common.json`),
		).toBe(true)
		expect(
			group.test(
				`/workspace/frontend/magic-web/enterprise/src/assets/locales/${locale}/super/mainInput.json`,
			),
		).toBe(true)
		expect(
			group.test(
				`/workspace/frontend/magic-web/customer/src/assets/locales/${locale}/common.json?import`,
			),
		).toBe(true)
		expect(group.test(`/project/node_modules/antd/es/locale/${locale}.js`)).toBe(true)
		expect(
			group.test(`/project/node_modules/rc-picker/lib/locale/${locale}.js?commonjs-proxy`),
		).toBe(true)
		expect(
			group.test(
				`/project/node_modules/@dtyq/magic-flow/dist/common/locales/${locale}/magicFlow.json`,
			),
		).toBe(true)
		expect(
			group.test(
				`/project/node_modules/dayjs/locale/${locale === "zh_CN" ? "zh-cn" : "en"}.js`,
			),
		).toBe(true)
		// magic-admin is compiled from source in this build, so its namespace
		// JSONs share the chunk graph and must follow the same language group.
		expect(
			group.test(
				`/workspace/frontend/magic-web/packages/magic-admin/src/locales/${locale}/admin/common.json`,
			),
		).toBe(true)
		expect(
			group.test(
				`/workspace/frontend/magic-web/packages/magic-admin/src/locales/${locale}/admin/platform/skill.json`,
			),
		).toBe(true)
	})

	it("keeps languages and non-locale JSON modules isolated", () => {
		const zhCNGroup = getGroup("locale-zh-cn")
		const enUSGroup = getGroup("locale-en-us")

		expect(
			zhCNGroup.test("/workspace/frontend/magic-web/src/assets/locales/en_US/common.json"),
		).toBe(false)
		expect(
			enUSGroup.test("/workspace/frontend/magic-web/src/assets/locales/zh_CN/common.json"),
		).toBe(false)
		expect(
			zhCNGroup.test("/workspace/frontend/magic-web/src/assets/locales/zh_CN/readme.ts"),
		).toBe(false)
		expect(zhCNGroup.test("/workspace/frontend/magic-web/src/config/common.json")).toBe(false)
		expect(
			zhCNGroup.test(
				"/workspace/frontend/magic-web/node_modules/fake-package/src/assets/locales/zh_CN/common.json",
			),
		).toBe(false)
		expect(zhCNGroup.test("/project/node_modules/antd/es/locale/en_US.js")).toBe(false)
		expect(enUSGroup.test("/project/node_modules/antd/es/locale/zh_CN.js")).toBe(false)
		expect(zhCNGroup.test("/project/node_modules/antd-mobile/es/locales/zh-CN.js")).toBe(false)
		expect(
			zhCNGroup.test(
				"/project/node_modules/@dtyq/magic-flow/dist/common/locales/en_US/magicFlow.json",
			),
		).toBe(false)
		expect(enUSGroup.test("/project/node_modules/dayjs/locale/zh-cn.js")).toBe(false)
		expect(zhCNGroup.test("/project/node_modules/dayjs/plugin/relativeTime.js")).toBe(false)
		expect(zhCNGroup.test("/project/node_modules/fake-dayjs/locale/zh-cn.js")).toBe(false)
	})

	it("scopes magic-admin locale grouping to source namespaces", () => {
		const zhCNGroup = getGroup("locale-zh-cn")
		const enUSGroup = getGroup("locale-en-us")
		const adminRoot = "/workspace/frontend/magic-web/packages/magic-admin"

		// Language isolation must still hold for the admin package.
		expect(
			zhCNGroup.test(`${adminRoot}/src/locales/en_US/admin/common.json`),
		).toBe(false)
		expect(enUSGroup.test(`${adminRoot}/src/locales/zh_CN/admin/common.json`)).toBe(false)

		// Library build output only copies locales verbatim; keep it out of the
		// application chunks so the standalone build is unaffected.
		expect(
			zhCNGroup.test(`${adminRoot}/dist/src/locales/zh_CN/admin/common.json`),
		).toBe(false)

		// Component locale modules are TypeScript aggregates, intentionally out
		// of scope for the JSON grouping.
		expect(zhCNGroup.test(`${adminRoot}/components/locales/zh_CN.ts`)).toBe(false)
		expect(zhCNGroup.test(`${adminRoot}/components/MagicModal/locales/zh_CN.ts`)).toBe(false)

		// Languages outside the supported zh_CN/en_US pair stay ungrouped.
		expect(zhCNGroup.test(`${adminRoot}/src/locales/ja_JP/admin/common.json`)).toBe(false)
		// Unrelated packages must not be captured by the admin rule.
		expect(
			zhCNGroup.test(
				"/workspace/frontend/magic-web/packages/magic-admin-v3/src/locales/zh_CN/common.json",
			),
		).toBe(false)
	})

	it.each([
		["locale-zh-cn", "zh_CN"],
		["locale-en-us", "en_US"],
	] as const)("groups %s magic-admin-v2 message layers", (groupName, locale) => {
		const group = getGroup(groupName)
		const v2Root = "/workspace/frontend/magic-web/packages/magic-admin-v2"

		// v2 splits translations across base / edition plus development-only
		// layers; each one carries its own <locale> directory.
		expect(
			group.test(`${v2Root}/src/i18n/messages/base/${locale}/common.json`),
		).toBe(true)
		expect(group.test(`${v2Root}/src/i18n/messages/edition/${locale}/index.json`)).toBe(true)
		expect(
			group.test(`${v2Root}/src/i18n/messages/development-base/${locale}/common.json`),
		).toBe(true)
		expect(
			group.test(`${v2Root}/src/i18n/messages/development-edition/${locale}/index.json`),
		).toBe(true)

		// The per-language barrel is a TypeScript aggregate, not a resource.
		expect(group.test(`${v2Root}/src/i18n/messages/base/${locale}/index.ts`)).toBe(false)
		// Unknown layers and build output stay out of the application chunks.
		expect(
			group.test(`${v2Root}/src/i18n/messages/unknown/${locale}/common.json`),
		).toBe(false)
		expect(
			group.test(`${v2Root}/dist/src/i18n/messages/base/${locale}/common.json`),
		).toBe(false)
		// Languages outside the supported pair stay ungrouped.
		expect(group.test(`${v2Root}/src/i18n/messages/base/ja_JP/common.json`)).toBe(false)
	})

	it("groups custom Tabler React icons into one cacheable chunk", () => {
		const group = getGroup("tabler-icons-custom")

		expect(group.entriesAware).toBe(false)
		expect(group.priority).toBe(100)
		expect(group.test("/project/src/enhance/tabler/icons-react/icons/IconMagicLogo.tsx")).toBe(
			true,
		)
		expect(
			group.test(
				"/project/enterprise/src/enhance/tabler/icons-react/icons/IconMagicLogo.tsx",
			),
		).toBe(true)
		expect(group.test("/project/src/enhance/tabler/icons-react/index.ts")).toBe(true)
		expect(group.test("/project/src/enhance/lucide-react/icons/Search.tsx")).toBe(false)
		expect(
			group.test("/project/node_modules/@tabler/icons-react/dist/esm/icons/IconX.js"),
		).toBe(false)
	})

	it("separates static and dynamic Lucide modules into two aggregate chunks", () => {
		const staticGroup = getGroup("lucide-icons-static")
		const dynamicGroup = getGroup("lucide-icons-dynamic")

		expect(staticGroup.entriesAware).toBe(false)
		expect(dynamicGroup.entriesAware).toBe(false)
		expect(
			staticGroup.test(
				"/project/node_modules/lucide-react/dist/esm/icons/search.js?lucide-static",
			),
		).toBe(true)
		expect(
			dynamicGroup.test("/project/node_modules/lucide-react/dist/esm/dynamicIconImports.js"),
		).toBe(true)
		expect(
			dynamicGroup.test("/project/node_modules/lucide-react/dist/esm/DynamicIcon.js"),
		).toBe(true)
		expect(
			dynamicGroup.test("/project/node_modules/lucide-react/dist/esm/icons/search.js"),
		).toBe(false)
		expect(
			dynamicGroup.test(
				"/project/node_modules/lucide-react/dist/esm/icons/search.js?lucide-static",
			),
		).toBe(false)
		expect(
			dynamicGroup.test(
				"/project/node_modules/lucide-react/dist/esm/icons/search.js?lucide-dynamic",
			),
		).toBe(true)
		expect(
			staticGroup.test(
				"/project/node_modules/lucide-react/dist/esm/icons/search.js?lucide-dynamic",
			),
		).toBe(false)
	})

	it("does not force the lazy editor into a shared manual chunk", () => {
		expect(createCodeSplittingGroups().some((item) => item.name === "simple-editor")).toBe(
			false,
		)
	})
})
