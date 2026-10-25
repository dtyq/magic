import { describe, it, expect } from "vitest"
// @ts-ignore
import {
	calculateCalvedRelativePath,
	convertFileToTabItem,
	dedupeTabsById,
	handleDuplicateTabNames,
	normalizeProjectTabItem,
} from "../tabUtils"
import type { TabItem } from "../../types"

describe("calculateCalvedRelativePath", () => {
	describe("when filePath is invalid", () => {
		it("should return undefined for undefined filePath", () => {
			expect(calculateCalvedRelativePath(undefined, [])).toBeUndefined()
		})

		it("should return undefined for empty string filePath", () => {
			expect(calculateCalvedRelativePath("", [])).toBeUndefined()
		})
	})

	describe("when no duplicates exist", () => {
		it("should return undefined when no existing paths match", () => {
			const filePath = "src/components/Button.tsx"
			const existingPaths = ["src/utils/helper.ts", "docs/README.md"]
			expect(calculateCalvedRelativePath(filePath, existingPaths)).toBeUndefined()
		})

		it("should return undefined when existingPaths is empty", () => {
			const filePath = "src/components/Button.tsx"
			expect(calculateCalvedRelativePath(filePath, [])).toBeUndefined()
		})
	})

	describe("when duplicates exist", () => {
		it("should return minimal unique path with ../ prefix", () => {
			const filePath = "src/components/Button.tsx"
			const existingPaths = ["lib/components/Button.tsx"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src/components")
		})

		it("should return deeper path when shallow path conflicts", () => {
			const filePath = "src/components/ui/Button.tsx"
			const existingPaths = ["lib/components/ui/Button.tsx", "app/components/Button.tsx"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src/components/ui")
		})

		it("should return full directory path when all partial paths conflict", () => {
			const filePath = "src/components/ui/Button.tsx"
			const existingPaths = [
				"lib/components/ui/Button.tsx",
				"app/components/ui/Button.tsx",
				"test/components/ui/Button.tsx",
			]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src/components/ui")
		})

		it("should handle root level files", () => {
			const filePath = "index.html"
			const existingPaths = ["public/index.html"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../")
		})

		it("should handle files in single directory", () => {
			const filePath = "src/index.ts"
			const existingPaths = ["lib/index.ts"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src")
		})

		it("should return minimum unique parent path", () => {
			const filePath = "src/components/ui/forms/Button.tsx"
			const existingPaths = ["lib/components/ui/forms/Button.tsx"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src/components/ui/forms")
		})

		it("should ignore null or undefined paths in existingPaths", () => {
			const filePath = "src/components/Button.tsx"
			const existingPaths = [null, undefined, "lib/components/Button.tsx", ""] as string[]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src/components")
		})
	})

	describe("edge cases", () => {
		it("should handle paths with same parent directory", () => {
			const filePath = "src/components/Button.tsx"
			const existingPaths = ["src/components/Input.tsx", "lib/components/Button.tsx"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../src/components")
		})

		it("should handle deeply nested identical paths", () => {
			const filePath = "a/b/c/d/e/f/file.txt"
			const existingPaths = ["x/b/c/d/e/f/file.txt", "y/b/c/d/e/f/file.txt"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../a/b/c/d/e/f")
		})

		it("should handle single character directory names", () => {
			const filePath = "a/b/c/file.txt"
			const existingPaths = ["x/b/c/file.txt"]
			const result = calculateCalvedRelativePath(filePath, existingPaths)
			expect(result).toBe("../a/b/c")
		})
	})
})

describe("handleDuplicateTabNames", () => {
	// Helper function to create mock TabItem
	const createMockTab = (id: string, filename: string, relativePath?: string): TabItem => ({
		id,
		title: filename,
		fileData: {
			file_id: id,
			file_name: filename,
			relative_file_path: relativePath,
		},
		active: false,
		closeable: true,
		filePath: relativePath,
	})

	describe("when no duplicates exist", () => {
		it("should add new tab normally without calvedRelativePath", () => {
			const state: TabItem[] = [
				createMockTab("1", "App.tsx", "src/App.tsx"),
				createMockTab("2", "utils.ts", "src/utils.ts"),
			]
			const newTab = createMockTab("3", "Button.tsx", "src/components/Button.tsx")
			newTab.active = true

			const result = handleDuplicateTabNames(state, newTab)

			expect(result).toHaveLength(3)
			expect(result[0].active).toBe(false)
			expect(result[1].active).toBe(false)
			expect(result[2].active).toBe(true)
			expect(result[2].calvedRelativePath).toBeUndefined()
		})

		it("should handle new tab without filePath", () => {
			const state: TabItem[] = [createMockTab("1", "App.tsx", "src/App.tsx")]
			const newTab = createMockTab("2", "Button.tsx")

			const result = handleDuplicateTabNames(state, newTab)

			expect(result).toHaveLength(2)
			expect(result[1].calvedRelativePath).toBeUndefined()
		})
	})

	describe("when duplicates exist", () => {
		it("should set calvedRelativePath for all duplicate tabs", () => {
			const state: TabItem[] = [
				createMockTab("1", "App.tsx", "src/App.tsx"),
				createMockTab("2", "index.html", "src/index.html"),
			]
			const newTab = createMockTab("3", "index.html", "public/index.html")

			const result = handleDuplicateTabNames(state, newTab)

			expect(result).toHaveLength(3)

			// Find the tabs with index.html
			const indexTabs = result.filter((tab) => tab.title === "index.html")
			expect(indexTabs).toHaveLength(2)

			// Both should have calvedRelativePath
			expect(indexTabs[0].calvedRelativePath).toBe("../src")
			expect(indexTabs[1].calvedRelativePath).toBe("../public")
		})

		it("should handle multiple duplicate files", () => {
			const state: TabItem[] = [
				createMockTab("1", "Button.tsx", "src/components/Button.tsx"),
				createMockTab("2", "Button.tsx", "lib/components/Button.tsx"),
			]
			const newTab = createMockTab("3", "Button.tsx", "app/components/Button.tsx")

			const result = handleDuplicateTabNames(state, newTab)

			expect(result).toHaveLength(3)

			const buttonTabs = result.filter((tab) => tab.title === "Button.tsx")
			expect(buttonTabs).toHaveLength(3)

			// All should have calvedRelativePath
			buttonTabs.forEach((tab) => {
				expect(tab.calvedRelativePath).toBeDefined()
				expect(tab.calvedRelativePath).toMatch(/^\.\.\//)
			})
		})

		it("should deactivate existing tabs and activate new tab", () => {
			const state: TabItem[] = [
				createMockTab("1", "App.tsx", "src/App.tsx"),
				{ ...createMockTab("2", "index.html", "src/index.html"), active: true },
			]
			const newTab = createMockTab("3", "index.html", "public/index.html")
			newTab.active = true

			const result = handleDuplicateTabNames(state, newTab)

			expect(result[0].active).toBe(false)
			expect(result[1].active).toBe(false)
			expect(result[2].active).toBe(true)
		})

		it("should handle tabs with missing filePath", () => {
			const state: TabItem[] = [
				createMockTab("1", "App.tsx", "src/App.tsx"),
				{ ...createMockTab("2", "index.html"), filePath: undefined },
			]
			const newTab = createMockTab("3", "index.html", "public/index.html")

			const result = handleDuplicateTabNames(state, newTab)

			expect(result).toHaveLength(3)
			expect(result[1].calvedRelativePath).toBeUndefined()
			expect(result[2].calvedRelativePath).toBeUndefined()
		})

		it("should prefer fileData.relative_file_path over filePath", () => {
			const state: TabItem[] = [createMockTab("1", "App.tsx", "src/App.tsx")]
			const newTab: TabItem = {
				id: "2",
				title: "App.tsx",
				fileData: {
					file_id: "2",
					file_name: "App.tsx",
					relative_file_path: "lib/App.tsx",
				},
				active: true,
				closeable: true,
				filePath: "different/path/App.tsx", // This should be ignored
			}

			const result = handleDuplicateTabNames(state, newTab)

			const appTabs = result.filter((tab) => tab.title === "App.tsx")
			expect(appTabs).toHaveLength(2)
			expect(appTabs[0].calvedRelativePath).toBe("../src")
			expect(appTabs[1].calvedRelativePath).toBe("../lib")
		})
	})

	describe("edge cases", () => {
		it("should handle empty state", () => {
			const state: TabItem[] = []
			const newTab = createMockTab("1", "App.tsx", "src/App.tsx")
			newTab.active = true

			const result = handleDuplicateTabNames(state, newTab)

			expect(result).toHaveLength(1)
			expect(result[0].active).toBe(true)
			expect(result[0].calvedRelativePath).toBeUndefined()
		})

		it("should handle filenames with special characters", () => {
			const state: TabItem[] = [
				createMockTab("1", "file-name.spec.ts", "src/tests/file-name.spec.ts"),
			]
			const newTab = createMockTab("2", "file-name.spec.ts", "lib/tests/file-name.spec.ts")

			const result = handleDuplicateTabNames(state, newTab)

			const specTabs = result.filter((tab) => tab.title === "file-name.spec.ts")
			expect(specTabs).toHaveLength(2)
			expect(specTabs[0].calvedRelativePath).toBe("../src/tests")
			expect(specTabs[1].calvedRelativePath).toBe("../lib/tests")
		})

		it("should handle very long paths", () => {
			const longPath = "a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z"
			const state: TabItem[] = [createMockTab("1", "file.txt", `${longPath}/file.txt`)]
			const newTab = createMockTab("2", "file.txt", `other/${longPath}/file.txt`)

			const result = handleDuplicateTabNames(state, newTab)

			const fileTabs = result.filter((tab) => tab.title === "file.txt")
			expect(fileTabs).toHaveLength(2)
			expect(fileTabs[0].calvedRelativePath).toBe(`../${longPath}`)
			expect(fileTabs[1].calvedRelativePath).toBe(`../other/${longPath}`)
		})
	})
})

describe("convertFileToTabItem", () => {
	it("uses the audio folder as the tab id when opening its index.html", () => {
		const indexFile = {
			file_id: "mock-audio-index",
			file_name: "index.html",
			relative_file_path: "mock-recording/index.html",
			parent_id: "mock-audio-folder",
			display_config: { type: "audio" },
		}
		const folder = {
			file_id: "mock-audio-folder",
			file_name: "mock-recording",
			is_directory: true,
			relative_file_path: "mock-recording",
			display_config: { type: "audio", name: "Mock recording" },
			children: [indexFile],
		}

		const folderTab = convertFileToTabItem(folder, [folder])
		const indexTab = convertFileToTabItem(indexFile, [folder])

		expect(folderTab?.id).toBe("mock-audio-folder")
		expect(indexTab?.id).toBe("mock-audio-folder")
		expect(indexTab?.fileData.file_id).toBe("mock-audio-folder")
		expect(indexTab?.fileData.is_directory).toBe(true)
		expect(indexTab?.display_config?.type).toBe("audio")
	})

	it("normalizes cached audio entry tabs and dedupes them with the folder tab", () => {
		const indexFile = {
			file_id: "mock-audio-index",
			file_name: "index.html",
			relative_file_path: "mock-recording/index.html",
			parent_id: "mock-audio-folder",
			display_config: { type: "audio" },
		}
		const folder = {
			file_id: "mock-audio-folder",
			file_name: "mock-recording",
			is_directory: true,
			relative_file_path: "mock-recording",
			display_config: { type: "audio", name: "Mock recording" },
			children: [indexFile],
		}
		const entryTab = normalizeProjectTabItem(
			{
				id: "mock-audio-index",
				title: "index.html",
				active: false,
				closeable: true,
				fileData: indexFile,
				filePath: "mock-recording/index.html",
			},
			[folder],
		)
		const folderTab = convertFileToTabItem(folder, [folder])!

		expect(dedupeTabsById([entryTab, folderTab])).toHaveLength(1)
		expect(dedupeTabsById([entryTab, folderTab])[0].id).toBe("mock-audio-folder")
	})

	it("keeps an unrelated index.html as a regular file tab", () => {
		const indexFile = {
			file_id: "mock-plain-index",
			file_name: "index.html",
			relative_file_path: "mock-site/index.html",
			parent_id: "mock-site-folder",
			display_config: { type: "html" },
		}

		const tab = convertFileToTabItem(indexFile, [indexFile])

		expect(tab?.id).toBe("mock-plain-index")
		expect(tab?.fileData.is_directory).toBeUndefined()
	})

	it("uses parent_id as a temporary audio folder id before attachments load", () => {
		const tab = convertFileToTabItem({
			file_id: "mock-audio-index",
			file_name: "index.html",
			relative_file_path: "mock-recording/index.html",
			parent_id: "mock-audio-folder",
			display_config: { type: "audio", name: "Mock recording" },
		})

		expect(tab?.id).toBe("mock-audio-folder")
		expect(tab?.fileData.is_directory).toBe(true)
		expect(tab?.fileData.relative_file_path).toBe("mock-recording")
	})

	it("uses the PPT folder as the tab id when opening its index.html", () => {
		const indexFile = {
			file_id: "index-file",
			file_name: "index.html",
			relative_file_path: "deck/index.html",
			parent_id: "deck-folder",
			display_config: { type: "html" },
		}
		const folder = {
			file_id: "deck-folder",
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "deck",
			display_config: { type: "slide" },
			children: [indexFile],
		}

		const folderTab = convertFileToTabItem(folder, [folder])
		const indexTab = convertFileToTabItem(indexFile, [folder])

		expect(folderTab?.id).toBe("deck-folder")
		expect(indexTab?.id).toBe("deck-folder")
		expect(indexTab?.fileData.file_id).toBe("deck-folder")
		expect(indexTab?.fileData.is_directory).toBe(true)
		expect(indexTab?.display_config?.type).toBe("slide")
	})

	it("normalizes cached PPT index tab and dedupes it with the folder tab", () => {
		const indexFile = {
			file_id: "index-file",
			file_name: "index.html",
			relative_file_path: "deck/index.html",
			parent_id: "deck-folder",
		}
		const folder = {
			file_id: "deck-folder",
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "deck",
			display_config: { type: "slide" },
			children: [indexFile],
		}
		const normalizedTabs = [
			normalizeProjectTabItem(
				{
					id: "index-file",
					title: "index.html",
					active: true,
					closeable: true,
					fileData: indexFile,
					filePath: "deck/index.html",
				},
				[folder],
			),
			convertFileToTabItem(folder, [folder])!,
		]

		const dedupedTabs = dedupeTabsById(normalizedTabs)

		expect(dedupedTabs).toHaveLength(1)
		expect(dedupedTabs[0].id).toBe("deck-folder")
		expect(dedupedTabs[0].active).toBe(true)
	})

	it("normalizes cached PPT tab fileData when only the tab id was migrated", () => {
		const indexFile = {
			file_id: "index-file",
			file_name: "index.html",
			relative_file_path: "deck/index.html",
			parent_id: "deck-folder",
		}
		const folder = {
			file_id: "deck-folder",
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "deck",
			display_config: { type: "slide" },
			children: [indexFile],
		}

		const normalizedTab = normalizeProjectTabItem(
			{
				id: "deck-folder",
				title: "index.html",
				active: true,
				closeable: true,
				fileData: indexFile,
				filePath: "deck/index.html",
			},
			[folder],
		)

		expect(normalizedTab.id).toBe("deck-folder")
		expect(normalizedTab.fileData.file_id).toBe("deck-folder")
		expect(normalizedTab.fileData.is_directory).toBe(true)
	})

	it("normalizes cached PPT index tab by parent_id before attachments are ready", () => {
		const normalizedTab = normalizeProjectTabItem({
			id: "932751570625261569",
			title: "青少年时间管理与高效学习法",
			active: true,
			closeable: true,
			fileData: {
				file_id: "932751570625261569",
				file_name: "index.html",
				file_extension: "html",
				relative_file_path: "/青少年时间管理与高效学习法/index.html",
				parent_id: "932751568893014017",
				is_directory: false,
				display_config: {
					type: "slide",
					name: "青少年时间管理与高效学习法",
				},
			},
			filePath: "/青少年时间管理与高效学习法/index.html",
			display_config: {
				type: "slide",
				name: "青少年时间管理与高效学习法",
			},
		})

		expect(normalizedTab.id).toBe("932751568893014017")
		expect(normalizedTab.fileData.file_id).toBe("932751568893014017")
		expect(normalizedTab.fileData.file_name).toBe("青少年时间管理与高效学习法")
		expect(normalizedTab.fileData.is_directory).toBe(true)
		expect(normalizedTab.fileData.relative_file_path).toBe("/青少年时间管理与高效学习法")
		expect(normalizedTab.filePath).toBe("/青少年时间管理与高效学习法")
	})

	it("does not normalize root index.html without a PPT folder path", () => {
		const normalizedTab = normalizeProjectTabItem({
			id: "index-file",
			title: "index.html",
			active: true,
			closeable: true,
			fileData: {
				file_id: "index-file",
				file_name: "index.html",
				file_extension: "html",
				relative_file_path: "/index.html",
				parent_id: "root-folder",
				display_config: {
					type: "slide",
					name: "Root Slide",
				},
			},
			filePath: "/index.html",
		})

		expect(normalizedTab.id).toBe("index-file")
		expect(normalizedTab.fileData.file_id).toBe("index-file")
		expect(normalizedTab.fileData.is_directory).toBeUndefined()
	})

	it("uses the template root as the tab when opening template.json", () => {
		const templateJson = {
			file_id: "template-json",
			file_name: "template.json",
			relative_file_path: "产品发布模板/template.json",
			parent_id: "template-root",
		}
		const slideHtml = {
			file_id: "slide-1",
			file_name: "cover.html",
			relative_file_path: "产品发布模板/slides/cover.html",
			parent_id: "slides-folder",
		}
		const slidesFolder = {
			file_id: "slides-folder",
			file_name: "slides",
			is_directory: true,
			relative_file_path: "产品发布模板/slides",
			parent_id: "template-root",
			children: [slideHtml],
		}
		const templateRoot = {
			file_id: "template-root",
			file_name: "产品发布模板",
			is_directory: true,
			relative_file_path: "产品发布模板",
			children: [
				templateJson,
				{ file_id: "spec", file_name: "visual-spec.md", is_directory: false },
				{ file_id: "theme", file_name: "theme.css", is_directory: false },
				slidesFolder,
			],
		}

		const rootTab = convertFileToTabItem(templateRoot, [templateRoot])
		const jsonTab = convertFileToTabItem(templateJson, [templateRoot])
		const slideTab = convertFileToTabItem(slideHtml, [templateRoot])

		expect(rootTab?.id).toBe("template-root")
		expect(rootTab?.display_config?.type).toBe("slide-template")
		expect(jsonTab?.id).toBe("template-root")
		expect(jsonTab?.fileData.file_id).toBe("template-root")
		expect(jsonTab?.display_config?.type).toBe("slide-template")
		expect(slideTab?.id).toBe("slide-1")
		expect(slideTab?.display_config?.type).not.toBe("slide-template")
	})

	it("injects slide-template display_config when normalizing a template root tab", () => {
		const templateRoot = {
			file_id: "template-root",
			file_name: "产品发布模板",
			is_directory: true,
			relative_file_path: "产品发布模板",
			children: [
				{ file_id: "template-json", file_name: "template.json", is_directory: false },
				{ file_id: "spec", file_name: "visual-spec.md", is_directory: false },
				{ file_id: "theme", file_name: "theme.css", is_directory: false },
				{ file_id: "slides", file_name: "slides", is_directory: true, children: [] },
			],
		}

		const normalizedTab = normalizeProjectTabItem(
			{
				id: "template-root",
				title: "产品发布模板",
				active: true,
				closeable: true,
				fileData: templateRoot,
				filePath: "产品发布模板",
			},
			[templateRoot],
		)

		expect(normalizedTab.id).toBe("template-root")
		expect(normalizedTab.display_config?.type).toBe("slide-template")
		expect(normalizedTab.fileData.display_config?.type).toBe("slide-template")
	})
})
