import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useHighImageGeneration } from "../useHighImageGeneration"

const { generateHighImage, getConvertHightConfig } = vi.hoisted(() => ({
	generateHighImage: vi.fn(),
	getConvertHightConfig: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		generateHighImage,
		getConvertHightConfig,
	},
}))

describe("useHighImageGeneration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		generateHighImage.mockResolvedValue({ status: "completed" })
	})

	it.each([
		["./images/", "/画布A/images/"],
		["/images/", "/images/"],
		["/画布B/images/", "/画布B/images/"],
		[undefined, "/画布A/images/"],
	])("derives file_dir %s through the resource resolver", async (fileDir, expectedFileDir) => {
		const { result } = renderHook(() =>
			useHighImageGeneration({
				projectId: "project-1",
				designProjectBasePath: "画布A",
				flatAttachments: [],
			}),
		)

		await act(async () => {
			await result.current.generateHightImage({
				image_id: "image-1",
				file_path: "./images/source.png",
				file_dir: fileDir,
			})
		})

		expect(generateHighImage).toHaveBeenCalledWith(
			expect.objectContaining({
				project_id: "project-1",
				file_path: "/画布A/images/source.png",
				file_dir: expectedFileDir,
			}),
		)
	})

	it("rejects traversal in an explicit output directory", async () => {
		const { result } = renderHook(() =>
			useHighImageGeneration({
				projectId: "project-1",
				designProjectBasePath: "画布A",
			}),
		)

		await expect(
			result.current.generateHightImage({
				image_id: "image-1",
				file_path: "./images/source.png",
				file_dir: "../images/",
			}),
		).rejects.toThrow("design.errors.designResourcePathUnresolved")
		expect(generateHighImage).not.toHaveBeenCalled()
	})
})
