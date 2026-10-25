import { describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	OptionViewType,
	type OptionGroup,
	type OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import {
	createSlidesFixedSceneConfig,
	createSlidesTemplateCategoryGroupKey,
	createSlidesTemplateTagGroupKey,
	createSlidesPresetPanelConfig,
	groupSlidesTemplates,
	isSlidesMode,
	markSlidesTemplateImageUrl,
	normalizeSlidesTemplateResponse,
	toTemplateOption,
	type SlidesTemplateCategoryItem,
	type SlidesTemplateItem,
	type SlidesTemplateTagItem,
} from "../slidesTemplateState"

const officialTemplate: SlidesTemplateItem = {
	code: "PPT-official",
	source_type: "SYSTEM",
	label: {
		zh_CN: "官方模板",
		en_US: "Official Template",
	},
	description: {
		zh_CN: "官方模板描述",
		en_US: "Official template description",
	},
	thumbnail_url: "https://example.com/official.png",
	collage_url: "https://example.com/official-collage.png",
	preview_image_urls: [
		"https://example.com/official-1.png",
		"https://example.com/official-2.png",
	],
	preview_url: "https://example.com/official-preview",
	sort: 100,
	is_official: true,
}

const organizationTemplate: SlidesTemplateItem = {
	code: "PPT-organization",
	source_type: "OFFICIAL",
	label: {
		zh_CN: "组织模板",
		en_US: "Organization Template",
	},
	description: {
		zh_CN: "组织模板描述",
		en_US: "Organization template description",
	},
	thumbnail_url: null,
	collage_url: null,
	preview_image_urls: [],
	preview_url: null,
	sort: 90,
	is_official: false,
}

const businessCategory: SlidesTemplateCategoryItem = {
	id: "1",
	code: "PPT-CATE-business",
	name: "商务",
	sort: 100,
	template_count: 1,
	is_official: true,
}

const educationCategory: SlidesTemplateCategoryItem = {
	id: "2",
	code: "PPT-CATE-education",
	name: "教育",
	sort: 90,
	template_count: 1,
	is_official: true,
}

const featuredTag: SlidesTemplateTagItem = {
	id: "tag-1",
	code: "featured",
	name: "精选",
	sort: 100,
	template_count: 1,
	is_official: true,
}

describe("slides template state", () => {
	it("normalizes localized list fields returned as strings", () => {
		const response = normalizeSlidesTemplateResponse({
			page: 1,
			page_size: 20,
			list: [
				{
					code: "PPT-string",
					label: "模板",
					description: "描述",
					is_official: true,
				},
			],
		})

		expect(response.list[0]?.label).toEqual({ zh_CN: "模板", en_US: "模板" })
		expect(response.list[0]?.description).toEqual({ zh_CN: "描述", en_US: "描述" })
	})

	it("detects PPT topic mode", () => {
		expect(isSlidesMode(TopicMode.PPT)).toBe(true)
		expect(isSlidesMode(TopicMode.General)).toBe(false)
	})

	it("groups official and organization templates", () => {
		const groups = groupSlidesTemplates([organizationTemplate, officialTemplate])

		expect(groups).toHaveLength(3)
		expect(groups[0].group_key).toBe("all")
		expect(groups[0].group_icon).toBeUndefined()
		expect(groups[0].group_name).toEqual({ zh_CN: "全部", en_US: "All" })
		expect(groups[0].children?.map((child) => child.value)).toEqual([
			organizationTemplate.code,
			officialTemplate.code,
		])
		expect(groups[1].group_key).toBe("official")
		expect(groups[1].group_icon).toBeUndefined()
		expect(groups[1].children?.[0].value).toBe(officialTemplate.code)
		expect(groups[2].group_key).toBe("organization")
		expect(groups[2].group_icon).toBeUndefined()
		expect(groups[2].children?.[0].value).toBe(organizationTemplate.code)
	})

	it("omits organization group when there are no organization templates", () => {
		const groups = groupSlidesTemplates([officialTemplate])

		expect(groups).toHaveLength(2)
		expect(groups[0].group_key).toBe("all")
		expect(groups[1].group_key).toBe("official")
	})

	it("groups templates by category order when categories are available", () => {
		const businessTemplate = {
			...officialTemplate,
			code: "PPT-business",
			category_code: businessCategory.code,
		}
		const educationTemplate = {
			...organizationTemplate,
			code: "PPT-education",
			category_code: educationCategory.code,
		}
		const groups = groupSlidesTemplates(
			[educationTemplate, businessTemplate],
			[businessCategory, educationCategory],
		)

		expect(groups.map((group) => group.group_key)).toEqual([
			"all",
			createSlidesTemplateCategoryGroupKey(businessCategory.code),
			createSlidesTemplateCategoryGroupKey(educationCategory.code),
		])
		expect(groups[1].group_name).toBe(businessCategory.name)
		expect(groups[1].group_icon).toBeUndefined()
		expect(groups[1].children?.[0].value).toBe(businessTemplate.code)
		expect(groups[2].children?.[0].value).toBe(educationTemplate.code)
	})

	it("keeps templates without matched category in other group", () => {
		const groups = groupSlidesTemplates([organizationTemplate], [businessCategory])

		expect(groups).toHaveLength(3)
		expect(groups[0].group_key).toBe("all")
		expect(groups[1].group_key).toBe(
			createSlidesTemplateCategoryGroupKey(businessCategory.code),
		)
		expect(groups[1].children).toEqual([])
		expect(groups[2].group_key).toBe("other")
		expect(groups[2].group_name).toEqual({ zh_CN: "其他", en_US: "Other" })
		expect(groups[2].group_icon).toBeUndefined()
		expect(groups[2].children?.[0].value).toBe(organizationTemplate.code)
	})

	it("does not add all and other visible groups when categories are empty", () => {
		const groups = groupSlidesTemplates([organizationTemplate], [])

		expect(groups).toHaveLength(1)
		expect(groups[0].group_key).toBe("all")
		expect(groups[0].children?.[0].value).toBe(organizationTemplate.code)
	})

	it("inserts operational tags before category groups", () => {
		const annualReportTag: SlidesTemplateTagItem = {
			...featuredTag,
			code: "purpose-annual-report",
			name: "年度报告",
		}
		const template = {
			...officialTemplate,
			category_code: businessCategory.code,
			tags: [
				{
					id: featuredTag.id,
					code: featuredTag.code,
					name: featuredTag.name,
					sort: featuredTag.sort,
				},
			],
		}

		const groups = groupSlidesTemplates(
			[template],
			[businessCategory],
			[featuredTag, annualReportTag],
		)

		expect(groups.map((group) => group.group_key)).toEqual([
			"all",
			createSlidesTemplateTagGroupKey(featuredTag.code),
			createSlidesTemplateTagGroupKey(annualReportTag.code),
			createSlidesTemplateCategoryGroupKey(businessCategory.code),
		])
		expect(groups[1].group_name).toBe(featuredTag.name)
		expect(groups[1].children?.[0].value).toBe(template.code)
	})

	it("keeps the slides preset panel when API returns no templates", () => {
		const sceneConfig = createSlidesFixedSceneConfig([])

		expect(sceneConfig.config.scenes_config.presets).toBeDefined()
	})

	it("leaves the input placeholder to the selected crew configuration", () => {
		const sceneConfig = createSlidesFixedSceneConfig([])

		expect(sceneConfig).not.toHaveProperty("placeholder")
	})

	it("keeps static page, size, and language fields available without preset defaults", () => {
		const panel = createSlidesPresetPanelConfig([officialTemplate])
		const items = panel.field?.items ?? []

		expect(panel.field?.view_type).toBe(OptionViewType.SLIDES_PRESET)
		expect(items.map((item) => item.data_key)).toEqual(["style", "pages", "size", "language"])
		expect(items.find((item) => item.data_key === "style")?.options).not.toEqual([])
		expect(items.find((item) => item.data_key === "pages")?.options).not.toEqual([])
		expect(items.find((item) => item.data_key === "pages")?.custom_input).toMatchObject({
			type: "number",
			min: 1,
			step: 1,
			integer: true,
		})
		const sizeField = items.find((item) => item.data_key === "size")
		const languageField = items.find((item) => item.data_key === "language")
		expect(sizeField?.options).not.toEqual([])
		expect(sizeField?.default_value).toBe("")
		expect(languageField?.options).not.toEqual([])
		expect(languageField?.default_value).toBe("")
		expect(languageField?.options).toHaveLength(18)
		expect(languageField?.options.slice(0, 4)).toEqual([
			{ value: "auto", label: { zh_CN: "自动", en_US: "Auto" } },
			{ value: "de", label: "Deutsch", preset_value: "Deutsch" },
			{ value: "en", label: "English", preset_value: "English" },
			{ value: "es", label: "Español", preset_value: "Español" },
		])
		expect(languageField?.options.at(-1)).toEqual({
			value: "hi",
			label: "हिन्दी",
			preset_value: "हिन्दी",
		})
	})

	it("maps API template fields and removes empty media URLs", () => {
		const template = {
			...organizationTemplate,
			usage_count: 12,
			colors: ["#111111", "#ffffff"],
			tags: [
				{
					id: featuredTag.id,
					code: featuredTag.code,
					name: featuredTag.name,
					sort: featuredTag.sort,
				},
			],
		}
		const panel = createSlidesPresetPanelConfig([template])
		const styleField = panel.field?.items.find((item) => item.data_key === "style")
		const group = styleField?.options[0] as OptionGroup | undefined
		const option = group?.children?.[0]

		expect(option?.value).toBe(template.code)
		expect(option?.label).toEqual(template.label)
		expect(option?.preset_value).toEqual({
			zh_CN: `组织模板（${template.code}）`,
			en_US: `Organization Template (${template.code})`,
		})
		expect(option?.description).toEqual(template.description)
		expect(option?.thumbnail_url).toBeUndefined()
		expect(option?.collage_url).toBeUndefined()
		expect(option?.preview_image_urls).toEqual([])
		expect(option?.preview_url).toBeUndefined()
		expect(option?.usage_count).toBe(12)
		expect(option?.colors).toEqual(template.colors)
		expect(option?.tags).toEqual(template.tags)
	})

	it("keeps detail preview URLs out of the Service Worker cache", () => {
		const option: OptionItem = toTemplateOption(officialTemplate)

		expect(option.collage_url).toBe(officialTemplate.collage_url)
		expect(option.preview_image_urls).toEqual(officialTemplate.preview_image_urls)
		expect(new URL(option.collage_url ?? "").searchParams.has("swCache")).toBe(false)
		expect(new URL(option.preview_image_urls?.[0] ?? "").searchParams.has("swCache")).toBe(
			false,
		)
	})

	it("marks featured template images for the isolated cache", () => {
		const template = {
			...officialTemplate,
			tags: [
				{
					id: featuredTag.id,
					code: featuredTag.code,
					name: featuredTag.name,
					sort: featuredTag.sort,
				},
			],
		}
		const panel = createSlidesPresetPanelConfig([template])
		const styleField = panel.field?.items.find((item) => item.data_key === "style")
		const group = styleField?.options[0] as OptionGroup | undefined
		const option = group?.children?.[0]

		expect(new URL(option?.thumbnail_url ?? "").searchParams.get("swCache")).toBe(
			"featured-slides-template-image-v2",
		)
		expect(new URL(option?.preview_image_urls?.[0] ?? "").searchParams.has("swCache")).toBe(
			false,
		)
	})

	it("marks only valid template image URLs for Service Worker caching", () => {
		const markedUrl = markSlidesTemplateImageUrl(
			"https://example.com/thumbnail.webp?x-tos-process=image%2Fresize%2Cw_720",
		)

		expect(markedUrl).toContain("x-tos-process=image%2Fresize%2Cw_720")
		expect(new URL(markedUrl ?? "").searchParams.get("swCache")).toBe(
			"slides-template-image-v2",
		)
		expect(markSlidesTemplateImageUrl(markedUrl)).toBe(markedUrl)
		expect(markSlidesTemplateImageUrl("not a url")).toBe("not a url")
		expect(markSlidesTemplateImageUrl("data:image/webp;base64,abc")).toBe(
			"data:image/webp;base64,abc",
		)
	})
})
