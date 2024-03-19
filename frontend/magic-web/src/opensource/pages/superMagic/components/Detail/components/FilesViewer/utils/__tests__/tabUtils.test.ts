import { describe, it, expect } from "vitest"
// @ts-ignore
import { calculateCalvedRelativePath, handleDuplicateTabNames } from "../tabUtils"
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
