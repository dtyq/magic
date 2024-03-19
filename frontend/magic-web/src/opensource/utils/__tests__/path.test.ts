import { describe, it, expect } from "vitest"
import { calculateRelativePath } from "../path"

describe("calculateRelativePath", () => {
	describe("Same directory", () => {
		it("should handle files in the same directory", () => {
			expect(calculateRelativePath("./docs/a.md", "./docs/b.md")).toBe("./b.md")
			expect(calculateRelativePath("/docs/a.md", "/docs/b.md")).toBe("./b.md")
		})

		it("should handle files in root directory", () => {
			expect(calculateRelativePath("./a.md", "./b.md")).toBe("./b.md")
			expect(calculateRelativePath("/a.md", "/b.md")).toBe("./b.md")
		})
	})

	describe("Parent directory", () => {
		it("should calculate path to parent directory", () => {
			expect(calculateRelativePath("./docs/guide.md", "./images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should handle multiple levels up", () => {
			expect(calculateRelativePath("./docs/api/ref.md", "./images/logo.png")).toBe(
				"../../images/logo.png",
			)
		})

		it("should handle deeply nested source to root level target", () => {
			expect(calculateRelativePath("./docs/api/v1/ref.md", "./config.json")).toBe(
				"../../../config.json",
			)
		})
	})

	describe("Child directory", () => {
		it("should calculate path to child directory", () => {
			expect(calculateRelativePath("./guide.md", "./docs/api/ref.md")).toBe(
				"./docs/api/ref.md",
			)
		})

		it("should handle immediate child directory", () => {
			expect(calculateRelativePath("./readme.md", "./docs/guide.md")).toBe("./docs/guide.md")
		})
	})

	describe("Different branches", () => {
		it("should handle paths in different directory branches", () => {
			expect(
				calculateRelativePath("./src/components/Button.tsx", "./lib/utils/helpers.ts"),
			).toBe("../../lib/utils/helpers.ts")
		})

		it("should handle complex branch navigation", () => {
			expect(
				calculateRelativePath("./src/pages/admin/users.tsx", "./assets/images/avatar.png"),
			).toBe("../../../assets/images/avatar.png")
		})
	})

	describe("Path normalization", () => {
		it("should normalize paths with leading ./", () => {
			expect(calculateRelativePath("./docs/guide.md", "./images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should normalize paths without leading ./", () => {
			expect(calculateRelativePath("docs/guide.md", "images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should normalize paths with leading / (treat as project-relative)", () => {
			// Leading "/" should be treated as project root, not system root
			expect(calculateRelativePath("/docs/guide.md", "/images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should handle user reported case: /录音总结.../录音纪要.md", () => {
			// Real-world case from user: absolute-like path with Chinese characters
			const result = calculateRelativePath(
				"/录音总结_20250929_111153/录音纪要.md",
				"./images/image_1760434377577.png",
			)
			// Should not leak virtual root
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("workspace")
			expect(result).not.toContain("project")
			expect(result).not.toContain("root")
			// Should produce valid relative path
			expect(result).toBe("../images/image_1760434377577.png")
		})

		it("should normalize paths with multiple leading slashes", () => {
			expect(calculateRelativePath("///docs/guide.md", "//images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should normalize paths with trailing slashes", () => {
			expect(calculateRelativePath("./docs/guide.md/", "./images/photo.png/")).toBe(
				"../images/photo.png",
			)
		})

		it("should handle mixed absolute and relative paths", () => {
			const result = calculateRelativePath("/folder/file.md", "./images/photo.png")
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("root")
		})
	})

	describe("Special characters", () => {
		it("should handle spaces in filenames", () => {
			expect(calculateRelativePath("./docs/user guide.md", "./images/my photo.png")).toBe(
				"../images/my photo.png",
			)
		})

		it("should handle Chinese characters", () => {
			expect(calculateRelativePath("./文档/指南.md", "./图片/照片.png")).toBe(
				"../图片/照片.png",
			)
		})

		it("should handle special characters", () => {
			expect(calculateRelativePath("./docs/file-name_v2.md", "./images/pic@2x.png")).toBe(
				"../images/pic@2x.png",
			)
		})
	})

	describe("Edge cases", () => {
		it("should handle empty directory names", () => {
			expect(calculateRelativePath("./a.md", "./b.md")).toBe("./b.md")
		})

		it("should handle long paths", () => {
			const fromPath = "./a/b/c/d/e/f/g/h/i/file.md"
			const toPath = "./x/y/z/target.md"
			// fromPath directory: /a/b/c/d/e/f/g/h/i (9 levels)
			// toPath directory: /x/y/z (3 levels)
			// Need 9 levels up to root, then down to x/y/z
			expect(calculateRelativePath(fromPath, toPath)).toBe(
				"../../../../../../../../../x/y/z/target.md",
			)
		})

		it("should handle paths with dots in filenames", () => {
			expect(calculateRelativePath("./docs/v1.2.3.md", "./images/logo.v2.png")).toBe(
				"../images/logo.v2.png",
			)
		})
	})

	describe("Common ancestor", () => {
		it("should find common ancestor correctly", () => {
			expect(
				calculateRelativePath(
					"./src/components/Button/index.tsx",
					"./src/utils/helpers.ts",
				),
			).toBe("../../utils/helpers.ts")
		})

		it("should handle partial common path", () => {
			expect(calculateRelativePath("./src/pages/home.tsx", "./src/components/nav.tsx")).toBe(
				"../components/nav.tsx",
			)
		})

		it("should handle no common ancestor (except root)", () => {
			expect(calculateRelativePath("./a/file.md", "./b/file.md")).toBe("../b/file.md")
		})
	})

	describe("Real-world examples", () => {
		it("should handle markdown image reference from docs", () => {
			// Document: ./docs/guide.md
			// Image uploaded to: ./images/screenshot.png
			expect(calculateRelativePath("./docs/guide.md", "./images/screenshot.png")).toBe(
				"../images/screenshot.png",
			)
		})

		it("should handle nested documentation structure", () => {
			// Document: ./docs/api/reference.md
			// Image uploaded to: ./images/diagrams/architecture.png
			expect(
				calculateRelativePath(
					"./docs/api/reference.md",
					"./images/diagrams/architecture.png",
				),
			).toBe("../../images/diagrams/architecture.png")
		})

		it("should handle root level document", () => {
			// Document: ./README.md
			// Image uploaded to: ./images/logo.png
			expect(calculateRelativePath("./README.md", "./images/logo.png")).toBe(
				"./images/logo.png",
			)
		})
	})

	describe("Paths with .. segments", () => {
		it("should normalize paths with .. in fromPath", () => {
			// "./docs/../guide.md" resolves to "./guide.md"
			// So calculating relative path from "./guide.md" to "./images/photo.png"
			expect(calculateRelativePath("./docs/../guide.md", "./images/photo.png")).toBe(
				"./images/photo.png",
			)
		})

		it("should normalize paths with .. in toPath", () => {
			// "./docs/../images/photo.png" resolves to "./images/photo.png"
			// From "./docs/guide.md" to "./images/photo.png" is "../images/photo.png"
			expect(calculateRelativePath("./docs/guide.md", "./docs/../images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should normalize complex paths with multiple ..", () => {
			// "./docs/api/../guide.md" resolves to "./docs/guide.md"
			// "./images/../assets/logo.png" resolves to "./assets/logo.png"
			// From "./docs/guide.md" to "./assets/logo.png" is "../assets/logo.png"
			expect(
				calculateRelativePath("./docs/api/../guide.md", "./images/../assets/logo.png"),
			).toBe("../assets/logo.png")
		})

		it("should handle paths with .. going above virtual root", () => {
			// "./../images/photo.png" tries to go above root, resolves relative to virtual root
			// From "./guide.md" (in /root) to "./../images/photo.png" (resolves to /images)
			// Result is "../images/photo.png" (going up from /root to / then down to /images)
			expect(calculateRelativePath("./guide.md", "./../images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should prevent generating invalid relative paths like ./../", () => {
			// This test ensures pathe properly normalizes ".." segments
			// "./../images/photo.png" from "/root/docs" perspective
			// From "./docs/guide.md" to "./../images/photo.png" (resolves to /images)
			// Result is "../../images/photo.png" (up from /root/docs to /root, then to /, then down to /images)
			expect(calculateRelativePath("./docs/guide.md", "./../images/photo.png")).toBe(
				"../../images/photo.png",
			)
		})

		it("should resolve multiple consecutive .. segments", () => {
			// "./a/../../images/photo.png" resolves to "../images/photo.png" from /root perspective
			// Which becomes "/images/photo.png" (above /root)
			// From "./a/b/c/file.md" (/root/a/b/c) to "/images/photo.png"
			// Result is "../../../../images/photo.png"
			expect(calculateRelativePath("./a/b/c/file.md", "./a/../../images/photo.png")).toBe(
				"../../../../images/photo.png",
			)
		})
	})

	describe("Paths with . segments", () => {
		it("should normalize paths with . in middle", () => {
			expect(calculateRelativePath("./docs/./guide.md", "./images/photo.png")).toBe(
				"../images/photo.png",
			)
		})

		it("should handle multiple . segments", () => {
			expect(calculateRelativePath("./docs/././guide.md", "./././images/photo.png")).toBe(
				"../images/photo.png",
			)
		})
	})

	describe("Virtual root leakage prevention", () => {
		it("should not leak virtual root in result", () => {
			const result = calculateRelativePath("./docs/guide.md", "./images/photo.png")
			expect(result).not.toContain("/root")
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("workspace")
			expect(result).not.toContain("project")
			expect(result).toBe("../images/photo.png")
		})

		it("should handle absolute-like paths without leaking virtual root", () => {
			const result = calculateRelativePath("/docs/guide.md", "/images/photo.png")
			expect(result).not.toContain("/root")
			expect(result).not.toContain("virtual")
		})

		it("should handle paths that might cause root leakage", () => {
			// This case might cause "./../root/..." in buggy implementations
			const result = calculateRelativePath("./file.md", "../images/photo.png")
			expect(result).not.toContain("/root")
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("workspace")
		})

		it("should fix the reported issue: ./../root/images/image.png", () => {
			// This was the actual issue reported by the user
			// toPath with "../" should not produce "./../root/..." or similar
			const result = calculateRelativePath(
				"./docs/guide.md",
				"../images/image_1760434377577.png",
			)

			// Should not contain any virtual directory names
			expect(result).not.toContain("root")
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("workspace")
			expect(result).not.toContain("project")

			// Should not start with "./../"
			expect(result).not.toMatch(/^\.\/\.\.\//)

			// Should be a valid relative path
			expect(result).toMatch(/^\.\.\//)
			expect(result).toBe("../../images/image_1760434377577.png")
		})

		it("should handle multiple ../ without leakage", () => {
			const result = calculateRelativePath("./a/b/c/file.md", "../../../../images/photo.png")
			expect(result).not.toContain("root")
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("workspace")
		})

		it("should handle extreme number of ../ (5+) without leakage", () => {
			const result = calculateRelativePath(
				"./docs/guide.md",
				"../../../../../images/photo.png",
			)
			expect(result).not.toContain("root")
			expect(result).not.toContain("virtual")
			expect(result).not.toContain("workspace")
			expect(result).not.toContain("project")
		})

		it("should handle paths without ./ prefix", () => {
			const result = calculateRelativePath("docs/guide.md", "images/photo.png")
			expect(result).not.toContain("root")
			expect(result).not.toContain("virtual")
			expect(result).toBe("../images/photo.png")
		})
	})

	describe("Input validation", () => {
		it("should throw error for empty fromPath", () => {
			expect(() => calculateRelativePath("", "./images/photo.png")).toThrow(
				"Both fromPath and toPath are required",
			)
		})

		it("should throw error for empty toPath", () => {
			expect(() => calculateRelativePath("./docs/guide.md", "")).toThrow(
				"Both fromPath and toPath are required",
			)
		})

		it("should throw error for both empty", () => {
			expect(() => calculateRelativePath("", "")).toThrow(
				"Both fromPath and toPath are required",
			)
		})
	})
})
