import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { createPlatformSlidesTemplateApi } from "../../../src/features/platform-slides-template/api.ts"
import { createSlidesTemplateFormSchema } from "../../../src/features/platform-slides-template/form-schema.ts"
import {
	ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY,
	ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY,
	SLIDES_TEMPLATE_FIELD_LIMITS,
	SLIDES_TEMPLATE_TAG_CODE_PATTERN,
	SLIDES_TEMPLATE_TAG_GROUP_CODE_PATTERN,
	buildSlidesTemplateSaveParams,
	generateSlidesTemplateCode,
	joinUploadDirectory,
} from "../../../src/features/platform-slides-template/utils.ts"

const componentRoot = "src/features/platform-slides-template/components"
const componentSource = {
	categoryDialog: readFileSync(`${componentRoot}/category-dialog.tsx`, "utf8"),
	categoryManager: readFileSync(`${componentRoot}/category-manager.tsx`, "utf8"),
	mobileCard: readFileSync(`${componentRoot}/template-mobile-card.tsx`, "utf8"),
	searchableCategorySelect: readFileSync(
		`${componentRoot}/searchable-category-select.tsx`,
		"utf8",
	),
	searchableTagSelect: readFileSync(`${componentRoot}/searchable-tag-select.tsx`, "utf8"),
	tagDialog: readFileSync(`${componentRoot}/tag-dialog.tsx`, "utf8"),
	tagManager: readFileSync(`${componentRoot}/tag-manager.tsx`, "utf8"),
	templateEditor: [
		"template-editor-sheet.tsx",
		"template-editor-form.tsx",
		"template-editor-preview.tsx",
		"template-editor-preview-images.tsx",
		"template-editor-upload-field.tsx",
	]
		.map((fileName) => readFileSync(`${componentRoot}/${fileName}`, "utf8"))
		.join("\n"),
	templateLibrary: readFileSync(`${componentRoot}/template-library.tsx`, "utf8"),
	searchableMultiSelect: readFileSync(
		"src/components/searchable-multi-select/searchable-multi-select.tsx",
		"utf8",
	),
}
const pageSource = readFileSync(
	"src/features/platform-slides-template/platform-slides-template-page.tsx",
	"utf8",
)
const dataTableSource = readFileSync("src/components/data-table.tsx", "utf8")
const switchSource = readFileSync("src/components/ui/switch.tsx", "utf8")

describe("slides template utilities", () => {
	const t = (key: string) => key
	const validFormValues = {
		category_code: "business",
		code: "PPT-template",
		collage_file_key: "",
		collage_url: "",
		description_en: "Description",
		description_zh: "描述",
		label_en: "Business",
		label_zh: "商务",
		preview_image_file_keys: [],
		preview_image_urls: [],
		preview_url: "https://example.com/preview",
		sort: 0,
		status: true,
		tag_codes: [],
		template_file_key: "private/template.zip",
		thumbnail_file_key: "public/thumbnail.png",
		thumbnail_url: "https://example.com/thumbnail.png",
	}

	it("validates PPT template editor values through a schema", () => {
		const schema = createSlidesTemplateFormSchema(t)
		assert.equal(schema.safeParse(validFormValues).success, true)

		const requiredResult = schema.safeParse({
			...validFormValues,
			description_en: " ",
			label_zh: " ",
			template_file_key: "",
			thumbnail_file_key: "",
		})
		assert.equal(requiredResult.success, false)
		if (!requiredResult.success) {
			assert.deepEqual(
				requiredResult.error.issues.map((issue) => issue.path.join(".")),
				["description_en", "label_zh", "template_file_key", "thumbnail_file_key"],
			)
		}

		assert.equal(
			schema.safeParse({ ...validFormValues, preview_url: "not-a-url" }).success,
			false,
		)
		assert.equal(schema.safeParse({ ...validFormValues, preview_url: "" }).success, true)
		assert.equal(schema.safeParse({ ...validFormValues, sort: -1 }).success, false)
		assert.equal(schema.safeParse({ ...validFormValues, sort: 1.5 }).success, false)
	})

	it("generates compatible codes and upload directories", () => {
		assert.match(generateSlidesTemplateCode(), /^PPT-[A-Za-z0-9]{12}$/)
		assert.equal(joinUploadDirectory("PPT-abc", true), "slide-templates/PPT-abc/previews/")
		assert.equal(joinUploadDirectory("PPT-abc"), "slide-templates/PPT-abc/")
	})

	it("keeps tag code rules aligned with the legacy admin", () => {
		assert.equal(SLIDES_TEMPLATE_TAG_CODE_PATTERN.test("sales-report"), true)
		assert.equal(SLIDES_TEMPLATE_TAG_CODE_PATTERN.test("Sales_Report"), false)
		assert.equal(SLIDES_TEMPLATE_TAG_GROUP_CODE_PATTERN.test("operational_group"), true)
		assert.equal(SLIDES_TEMPLATE_TAG_GROUP_CODE_PATTERN.test("operational"), false)
	})

	it("does not send code when saving an existing template", () => {
		const params = buildSlidesTemplateSaveParams(
			{
				category_code: "business",
				code: "PPT-existing",
				collage_file_key: "",
				collage_url: "",
				description_en: "Description",
				description_zh: "描述",
				label_en: "Business",
				label_zh: "商务",
				preview_image_file_keys: [],
				preview_image_urls: [],
				preview_url: "",
				sort: 1,
				status: true,
				tag_codes: [],
				template_file_key: "private/template.zip",
				thumbnail_file_key: "public/thumbnail.png",
				thumbnail_url: "https://example.com/thumbnail.png",
			},
			false,
		)
		assert.equal("code" in params, false)
	})

	it("keeps legacy field limits and enabled editor option queries", () => {
		assert.deepEqual(SLIDES_TEMPLATE_FIELD_LIMITS, {
			code: 64,
			description: 1000,
			name: 100,
			previewUrl: 1024,
		})
		assert.deepEqual(ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY, {
			page: 1,
			page_size: 200,
			status: 1,
		})
		assert.deepEqual(ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY, {
			node_type: "tag",
			page: 1,
			page_size: 200,
			status: 1,
		})
	})
})

describe("slides template component regressions", () => {
	it("waits for a successful detail request before enabling edit fields", () => {
		assert.equal(componentSource.templateEditor.includes("detailQuery.data ?? template"), false)
		assert.match(componentSource.templateEditor, /const isDetailReady =/)
		assert.match(componentSource.templateEditor, /detailQuery\.isError/)
		assert.match(componentSource.templateEditor, /TemplateEditorDetailSkeleton/)
		assert.match(componentSource.templateEditor, /disabled=\{isBusy \|\| !isDetailReady\}/)
	})

	it("requests enabled categories and tags in parallel for the editor", () => {
		assert.match(
			componentSource.templateEditor,
			/useSlidesTemplateCategoriesQuery\(\s*ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY/,
		)
		assert.match(
			componentSource.templateEditor,
			/useSlidesTemplateTagsQuery\(ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY, open\)/,
		)
		assert.equal(
			componentSource.templateEditor.includes("useSlidesTemplateTagTreeQuery"),
			false,
		)
		assert.match(
			componentSource.templateLibrary,
			/useSlidesTemplateCategoriesQuery\(\s*ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY/,
		)
		assert.match(
			componentSource.templateLibrary,
			/useSlidesTemplateTagsQuery\(\s*ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY/,
		)
		assert.equal(
			componentSource.templateLibrary.includes("useSlidesTemplateTagTreeQuery"),
			false,
		)
	})

	it("debounces all keyword and code filters and lazily loads category and tag options separately", () => {
		assert.match(pageSource, /useListQueryParams/)
		assert.equal(
			[componentSource.templateLibrary, componentSource.categoryManager, componentSource.tagManager].some(
				(source) => source.includes("useListQueryParams"),
			),
			false,
		)
		assert.match(pageSource, /debounceFields: \["keyword", "code"\]/)
		for (const source of [
			componentSource.templateLibrary,
			componentSource.categoryManager,
			componentSource.tagManager,
		]) {
			assert.match(source, /<ListFilterPanel/)
		}
		assert.match(componentSource.templateLibrary, /categoryOptionsOpen/)
		assert.match(componentSource.templateLibrary, /tagOptionsOpen/)
		assert.equal(componentSource.templateLibrary.includes("const [optionsOpen"), false)
	})

	it("keeps category and tag keyword, code, and status as independent panel fields", () => {
		for (const source of [componentSource.categoryManager, componentSource.tagManager]) {
			assert.match(source, /<ListFilterPanel/u)
			assert.match(source, /value=\{value\.keyword\}/u)
			assert.match(source, /value=\{value\.code\}/u)
			assert.match(source, /value=\{value\.status\}/u)
			assert.match(source, /onChange=\{\(patch\)/u)
			assert.match(source, /createDefaultValue=/u)
		}
		assert.match(
			componentSource.tagManager,
			/label=\{t\("slidesTemplate\.tagName"\)\}[\s\S]*?placeholder=\{t\("slidesTemplate\.tagName"\)\}/u,
		)
		assert.doesNotMatch(componentSource.tagManager, /label=\{t\("slidesTemplate\.keyword"\)\}/u)
	})

	it("keeps inline pending state scoped to the affected row", () => {
		for (const source of [
			componentSource.templateLibrary,
			componentSource.categoryManager,
			componentSource.tagManager,
		]) {
			assert.match(source, /useRowPendingIds\(\)/)
			assert.match(source, /statusPendingIds\.has/)
			assert.match(source, /sortPendingIds\.has/)
		}
		for (const source of [
			componentSource.templateLibrary,
			componentSource.categoryManager,
			componentSource.tagManager,
		]) {
			assert.match(source, /loading=\{statusPendingIds\.has/)
		}
		assert.match(componentSource.mobileCard, /loading=\{statusPending\}/)
		assert.match(switchSource, /loading\?: boolean/)
		assert.match(switchSource, /aria-busy=\{loading \|\| undefined\}/)
		assert.match(switchSource, /Loader2/)
	})

	it("selects newly created tag resources and preserves required and length constraints", () => {
		assert.match(componentSource.tagManager, /onCreated=\{\(group\) =>/)
		assert.match(componentSource.tagManager, /onSelectedGroupIdChange\(String\(group\.id\)\)/)
		assert.match(componentSource.tagManager, /onCreated=\{\(tag\) =>/)
		assert.match(componentSource.tagManager, /onSelectedGroupIdChange\(String\(tag\.parent_id\)\)/)
		assert.match(componentSource.tagManager, /setSelectedTagId\(String\(tag\.id\)\)/)
		assert.match(componentSource.tagManager, /selectedRowId=\{selectedTagId \?\? undefined\}/)
		assert.match(dataTableSource, /selectedRowId\?: string/)
		assert.match(dataTableSource, /row\.id === selectedRowId/)
		assert.match(
			componentSource.categoryDialog,
			/label=\{t\("slidesTemplate\.form\.nameZh"\)\}[\s\S]*?required/,
		)
		assert.match(componentSource.categoryDialog, /SLIDES_TEMPLATE_FIELD_LIMITS\.name/)
		assert.match(
			componentSource.tagDialog,
			/label=\{t\("slidesTemplate\.parentGroup"\)\}[\s\S]*?required/,
		)
		assert.match(componentSource.tagDialog, /SLIDES_TEMPLATE_FIELD_LIMITS\.description/)
	})

	it("uses context-specific code labels", () => {
		assert.match(componentSource.templateLibrary, /slidesTemplate\.templateCode/)
		assert.match(componentSource.categoryManager, /slidesTemplate\.categoryCode/)
		assert.match(componentSource.tagManager, /slidesTemplate\.tagCode/)
		assert.match(componentSource.tagDialog, /slidesTemplate\.tagGroupCode/)
	})

	it("keeps editor and library option selectors searchable and uses resource-specific delete copy", () => {
		assert.match(componentSource.templateEditor, /<Form \{\.\.\.form\}>/)
		assert.match(componentSource.templateEditor, /useFormContext<SlidesTemplateFormValues>\(\)/)
		assert.match(componentSource.templateEditor, /FormControl/)
		assert.match(componentSource.templateEditor, /FormMessage className="text-xs"/)
		assert.match(componentSource.templateEditor, /forwardRef</)
		assert.match(componentSource.templateEditor, /const SortInput = forwardRef/)
		assert.match(componentSource.templateEditor, /if \(draft === ""\)/)
		assert.equal(componentSource.templateEditor.includes("function FormField("), false)
		assert.match(componentSource.templateEditor, /SearchableCategorySelect/)
		assert.equal(componentSource.templateEditor.includes('SelectItem value="none"'), false)
		assert.match(componentSource.templateLibrary, /SearchableCategorySelect/)
		assert.match(componentSource.templateEditor, /SearchableTagSelect/)
		assert.match(componentSource.templateLibrary, /SearchableTagSelect/)
		assert.equal(componentSource.templateEditor.includes("function TagSelector"), false)
		assert.match(
			componentSource.searchableCategorySelect,
			/slidesTemplate\.form\.searchCategories/,
		)
		assert.match(componentSource.searchableCategorySelect, /onChange\(""\)/)
		assert.match(componentSource.searchableTagSelect, /slidesTemplate\.form\.searchTags/)
		assert.match(componentSource.searchableTagSelect, /slidesTemplate\.form\.noMatchingTags/)
		assert.match(componentSource.searchableTagSelect, /SearchableMultiSelect/)
		assert.match(componentSource.searchableMultiSelect, /hiddenSelectedCount/)
		assert.match(componentSource.searchableMultiSelect, /onChange\(\[\]\)/)
		assert.match(pageSource, /record\.node_type === "group" \? "tagGroup" : "tag"/)
		for (const resource of ["template", "category", "tagGroup", "tag"]) {
			assert.match(
				pageSource,
				new RegExp(`slidesTemplate\\.deleteConfirm\\.${resource}Title`),
			)
			assert.match(
				pageSource,
				new RegExp(`slidesTemplate\\.deleteConfirm\\.${resource}Description`),
			)
		}
	})
})

describe("slides template API", () => {
	it("uses the legacy endpoint contract", async () => {
		const calls: Array<{ method: string; url: string; data?: unknown }> = []
		const client = {
			delete: async <T>(url: string, data?: unknown) => {
				calls.push({ method: "delete", url, data })
				return null as T
			},
			get: async <T>(url: string) => {
				calls.push({ method: "get", url })
				return null as T
			},
			patch: async <T>() => null as T,
			post: async <T, D>(url: string, data?: D) => {
				calls.push({ method: "post", url, data })
				return null as T
			},
			put: async <T, D>(url: string, data?: D) => {
				calls.push({ method: "put", url, data })
				return null as T
			},
		}
		const api = createPlatformSlidesTemplateApi(client)
		await api.query({ page: 1, page_size: 20 })
		await api.updateStatus("template-1", 1)
		await api.category.query({ page: 1, page_size: 20 })
		await api.tag.query({ node_type: "tag", page: 1, page_size: 20 })
		assert.deepEqual(
			calls.map((call) => call.url),
			[
				"/api/v1/admin/slides-templates/queries",
				"/api/v1/admin/slides-templates/template-1/status",
				"/api/v1/admin/slides-template-categories/queries",
				"/api/v1/admin/slides-template-tags/queries",
			],
		)
	})
})
