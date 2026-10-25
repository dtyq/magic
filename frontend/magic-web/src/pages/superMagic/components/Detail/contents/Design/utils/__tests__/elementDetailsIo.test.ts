import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import type { CanvasDocument, LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import {
	hydrateDesignDataDetails,
	setHydratedElementDetailsProvenance,
	writeUserElementDetails,
} from "../elementDetailsIo"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createFile: vi.fn(),
		saveFileContent: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
}))

const EMPTY_DETAILS_DOC = {
	version: "2.0.0",
	elements: {},
}

function file(file_id: string, file_name: string, parent_id: string | null) {
	return {
		file_id,
		file_name,
		parent_id,
		is_directory: false,
	}
}

function designData(elements: LayerElement[] = []) {
	return {
		type: "design",
		name: "design",
		version: "3.0.0",
		canvas: { elements } as CanvasDocument,
	}
}

describe("writeUserElementDetails", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue({} as never)
	})

	it("skips saving when an existing user sidecar is already empty", async () => {
		vi.mocked(getFileContentById).mockResolvedValue(JSON.stringify(EMPTY_DETAILS_DOC) as never)

		await writeUserElementDetails(designData(), {
			mainFileId: "main",
			flatAttachments: [
				file("main", "magic.project.js", "dir"),
				file("user-details", "element-details-user.json", "dir"),
			] as never,
			projectId: "project-1",
		})

		expect(SuperMagicApi.createFile).not.toHaveBeenCalled()
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})

	it("skips saving when an existing user sidecar content is unchanged", async () => {
		const userDoc = {
			version: "2.0.0",
			elements: {
				"image-1": {
					contentDetails: {
						"image-1-content-1": { generateImageRequest: { prompt: "same" } },
					},
					source: "user",
				},
			},
		}
		vi.mocked(getFileContentById).mockResolvedValue(JSON.stringify(userDoc) as never)

		await writeUserElementDetails(
			designData([
				{
					id: "image-1",
					type: "image",
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					activeContentId: "image-1-content-1",
					mainContentId: "image-1-content-1",
					contents: [
						{
							contentId: "image-1-content-1",
							generateImageRequest: { prompt: "same" },
						},
					],
				} as LayerElement,
			]),
			{
				mainFileId: "main",
				flatAttachments: [
					file("main", "magic.project.js", "dir"),
					file("user-details", "element-details-user.json", "dir"),
				] as never,
				projectId: "project-1",
			},
		)

		expect(SuperMagicApi.createFile).not.toHaveBeenCalled()
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})

	it("saves one empty document when clearing a previously non-empty user sidecar", async () => {
		vi.mocked(getFileContentById).mockResolvedValue(
			JSON.stringify({
				version: "2.0.0",
				elements: {
					"image-1": {
						contentDetails: {
							"image-1-content-1": { generateImageRequest: { prompt: "old" } },
						},
						source: "user",
					},
				},
			}) as never,
		)

		await writeUserElementDetails(designData(), {
			mainFileId: "main",
			flatAttachments: [
				file("main", "magic.project.js", "dir"),
				file("user-details", "element-details-user.json", "dir"),
			] as never,
			projectId: "project-1",
		})

		expect(SuperMagicApi.createFile).not.toHaveBeenCalled()
		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledWith([
			{
				file_id: "user-details",
				content: JSON.stringify({ version: "2.0.0", elements: {} }, null, 2),
				enable_shadow: true,
			},
		])
	})

	it("does not write agent-sourced Content to the user sidecar", async () => {
		const agentDoc = {
			version: "2.0.0",
			elements: {
				"image-1": {
					contentDetails: {
						c1: { generateImageRequest: { prompt: "old" } },
					},
				},
			},
		}
		vi.mocked(getFileContentById).mockImplementation(async (fileId: string) => {
			if (fileId === "agent-details") return JSON.stringify(agentDoc) as never
			return JSON.stringify(EMPTY_DETAILS_DOC) as never
		})

		const data = designData([
			{
				id: "image-1",
				type: "image",
				activeContentId: "c1",
				mainContentId: "c1",
				contents: [{ contentId: "c1", generateImageRequest: { prompt: "old" } }],
			} as LayerElement,
		])
		setHydratedElementDetailsProvenance(data, {
			"image-1": {
				contentDetails: {
					c1: { sidecarSource: "agent" },
				},
			},
		})

		const result = await writeUserElementDetails(data, {
			mainFileId: "main",
			flatAttachments: [
				file("main", "magic.project.js", "dir"),
				file("agent-details", "element-details.json", "dir"),
				file("user-details", "element-details-user.json", "dir"),
			] as never,
			projectId: "project-1",
		})

		expect(result).toBe("unchanged")
		expect(SuperMagicApi.createFile).not.toHaveBeenCalled()
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})

	it("does not create a user sidecar when the canvas only has agent-owned Contents", async () => {
		const agentDoc = {
			version: "2.0.0",
			elements: {
				"image-1": {
					contentDetails: {
						c1: { generateImageRequest: { prompt: "agent" } },
					},
				},
			},
		}
		vi.mocked(getFileContentById).mockResolvedValue(JSON.stringify(agentDoc) as never)

		const data = designData([
			{
				id: "image-1",
				type: "image",
				activeContentId: "c1",
				mainContentId: "c1",
				contents: [{ contentId: "c1", generateImageRequest: { prompt: "agent" } }],
			} as LayerElement,
		])
		setHydratedElementDetailsProvenance(data, {
			"image-1": {
				contentDetails: {
					c1: { sidecarSource: "agent" },
				},
			},
		})

		const result = await writeUserElementDetails(data, {
			mainFileId: "main",
			flatAttachments: [
				file("main", "magic.project.js", "dir"),
				file("agent-details", "element-details.json", "dir"),
			] as never,
			projectId: "project-1",
		})

		expect(result).toBe("skipped")
		expect(SuperMagicApi.createFile).not.toHaveBeenCalled()
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})

	it("keeps canvas-created Content in the user sidecar when agent Content also exists", async () => {
		const agentDoc = {
			version: "2.0.0",
			elements: {
				"image-1": {
					contentDetails: {
						c1: { generateImageRequest: { prompt: "agent" } },
					},
				},
			},
		}
		vi.mocked(getFileContentById).mockImplementation(async (fileId: string) => {
			if (fileId === "agent-details") return JSON.stringify(agentDoc) as never
			return JSON.stringify(EMPTY_DETAILS_DOC) as never
		})

		const data = designData([
			{
				id: "image-1",
				type: "image",
				activeContentId: "c2",
				mainContentId: "c1",
				contents: [
					{ contentId: "c1", generateImageRequest: { prompt: "agent" } },
					{ contentId: "c2", generateImageRequest: { prompt: "new-user" } },
				],
			} as LayerElement,
		])
		setHydratedElementDetailsProvenance(data, {
			"image-1": {
				contentDetails: {
					c1: { sidecarSource: "agent" },
					c2: { sidecarSource: "user" },
				},
			},
		})

		await writeUserElementDetails(data, {
			mainFileId: "main",
			flatAttachments: [
				file("main", "magic.project.js", "dir"),
				file("agent-details", "element-details.json", "dir"),
				file("user-details", "element-details-user.json", "dir"),
			] as never,
			projectId: "project-1",
		})

		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledWith([
			{
				file_id: "user-details",
				content: JSON.stringify(
					{
						version: "2.0.0",
						elements: {
							"image-1": {
								contentDetails: {
									c2: { generateImageRequest: { prompt: "new-user" } },
								},
								source: "user",
							},
						},
					},
					null,
					2,
				),
				enable_shadow: true,
			},
		])
	})

	it("blocks unsupported imageVersionDetails without overwriting the sidecar", async () => {
		vi.mocked(getFileContentById).mockResolvedValue(
			JSON.stringify({
				version: "1.1.0",
				elements: {
					"image-1": {
						imageVersionDetails: {
							"version-1": { generateImageRequest: { prompt: "legacy" } },
						},
						source: "user",
					},
				},
			}) as never,
		)

		const result = await writeUserElementDetails(designData(), {
			mainFileId: "main",
			flatAttachments: [
				file("main", "magic.project.js", "dir"),
				file("user-details", "element-details-user.json", "dir"),
			] as never,
			projectId: "project-1",
		})

		expect(result).toBe("blocked-unsupported")
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})

	it("marks imageVersionDetails as unsupported while keeping the main DSL loadable", async () => {
		vi.mocked(getFileContentById).mockResolvedValue(
			JSON.stringify({
				version: "1.1.0",
				elements: {
					"image-1": {
						imageVersionDetails: {
							"version-1": { generateImageRequest: { prompt: "legacy" } },
						},
					},
				},
			}) as never,
		)
		const data = designData([
			{
				id: "image-1",
				type: "image",
				activeContentId: "image-1-content-1",
				mainContentId: "image-1-content-1",
				contents: [{ contentId: "image-1-content-1", src: "./images/a.png" }],
			} as LayerElement,
		])

		await expect(
			hydrateDesignDataDetails(data, {
				mainFileId: "main",
				flatAttachments: [
					file("main", "magic.project.js", "dir"),
					file("user-details", "element-details-user.json", "dir"),
				] as never,
			}),
		).resolves.toMatchObject({ status: "unsupported", provenance: {} })
	})
})
