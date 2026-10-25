import { describe, expect, it } from "vitest"
import type { ReferenceResourcePanelItem } from "../../../../public/props"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
} from "../reference-assets/reference-resource.types"
import { filterReferenceResourcePanelBatchItems } from "../reference-assets/referenceResourceSelection"
import { CANVAS_REFERENCE_MENTION_ITEM_TYPE } from "../reference-assets/canvasReferenceMention.constants"
import {
	checkProjectReferenceResourceDrop,
	normalizeProjectDropFilesForStorage,
} from "../reference-assets/useReferenceResourcePanelDataService"

function panelItem(
	path: string,
	fileName = path.split("/").pop() || path,
): ReferenceResourcePanelItem {
	const extension = fileName.includes(".") ? `.${fileName.split(".").pop() ?? ""}` : ""
	return {
		type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
		data: {
			file_id: path,
			file_name: fileName,
			file_path: path,
			file_extension: extension,
		},
	}
}

const mediaLimits: ReferenceAssetPerTypeLimits = {
	reference_images: { min: 0, max: 2 },
	reference_videos: { min: 0, max: 1 },
	reference_audios: { min: 0, max: 1 },
	total: { min: 0, max: 4 },
}

const resolveDesignAResourceReference = createTestResourceReferenceResolver({
	attachmentPathsByFileId: {
		"current-cat": "画布A/images/cat.png",
		"other-cat": "画布B/images/cat.png",
		"root-cat": "images/cat.png",
		"project-root-cat": "cat.png",
	},
})

describe("filterReferenceResourcePanelBatchItems", () => {
	it("slices project selections by remaining total capacity", () => {
		const selected = filterReferenceResourcePanelBatchItems({
			items: [
				panelItem("project/a.png"),
				panelItem("project/b.png"),
				panelItem("project/c.png"),
			],
			maxReferenceFiles: 2,
			currentReferenceFiles: ["project/existing.png"],
		})

		expect(selected.map((item) => item.data.file_path)).toEqual(["project/a.png"])
	})

	it("does not consume capacity for files already present", () => {
		const selected = filterReferenceResourcePanelBatchItems({
			items: [panelItem("project/existing.png"), panelItem("project/a.png")],
			maxReferenceFiles: 1,
			currentReferenceFiles: ["project/existing.png"],
		})

		expect(selected.map((item) => item.data.file_path)).toEqual(["project/existing.png"])
	})

	it("does not consume capacity for canonical path variants of an existing file", () => {
		const selected = filterReferenceResourcePanelBatchItems({
			items: [panelItem("/画布A/images/existing.png"), panelItem("/画布A/images/new.png")],
			maxReferenceFiles: 1,
			currentReferenceFiles: ["./images/existing.png"],
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(selected.map((item) => item.data.file_path)).toEqual(["/画布A/images/existing.png"])
	})

	it("treats workspace-root and current-canvas paths as separate capacity entries with host identity", () => {
		const selected = filterReferenceResourcePanelBatchItems({
			items: [panelItem("/images/existing.png")],
			maxReferenceFiles: 1,
			currentReferenceFiles: ["./images/existing.png"],
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(selected).toEqual([])
	})

	it("respects per-asset-type capacity and total capacity", () => {
		const currentAssetCounts: ReferenceAssetTypeCounts = {
			images: 1,
			videos: 0,
			audios: 0,
		}

		const selected = filterReferenceResourcePanelBatchItems({
			items: [
				panelItem("project/a.png"),
				panelItem("project/b.png"),
				panelItem("project/clip.mp4"),
			],
			assetLimits: mediaLimits,
			currentAssetCounts,
		})

		expect(selected.map((item) => item.data.file_path)).toEqual([
			"project/a.png",
			"project/clip.mp4",
		])
	})

	it("filters mixed project batches item by item", () => {
		const selected = filterReferenceResourcePanelBatchItems({
			items: [
				panelItem("project/a.png"),
				panelItem("project/clip.mp4"),
				panelItem("project/sound.mp3"),
				panelItem("project/readme.txt"),
			],
			assetLimits: mediaLimits,
			currentAssetCounts: { images: 2, videos: 0, audios: 0 },
		})

		expect(selected.map((item) => item.data.file_path)).toEqual([
			"project/clip.mp4",
			"project/sound.mp3",
		])
	})

	it("applies an entrance-specific batch cap", () => {
		const selected = filterReferenceResourcePanelBatchItems({
			items: [
				panelItem("project/a.png"),
				panelItem("project/b.png"),
				panelItem("project/c.png"),
			],
			maxBatchItems: 1,
		})

		expect(selected.map((item) => item.data.file_path)).toEqual(["project/a.png"])
	})
})

describe("project reference resource resolution", () => {
	it("uses attachment identity to match a current-canvas storage alias", () => {
		const files = [
			{
				path: "/画布A/images/cat.png",
				fileName: "cat.png",
				fileId: "current-cat",
			},
		]
		expect(
			checkProjectReferenceResourceDrop({
				isDropEnabled: true,
				files,
				matchableItems: [{ path: "./images/cat.png" }],
				currentReferenceFiles: [],
				resolveResourceReference: resolveDesignAResourceReference,
			}).accepted,
		).toBe(true)
	})

	it("accepts a workspace-root resource when both root and current-canvas nodes exist", () => {
		const files = [{ path: "/images/cat.png", fileName: "cat.png", fileId: "root-cat" }]

		expect(
			checkProjectReferenceResourceDrop({
				isDropEnabled: true,
				files,
				matchableItems: [{ path: "./images/cat.png" }, { path: "/images/cat.png" }],
				currentReferenceFiles: [],
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual({ accepted: true })
	})

	it("does not match other canvas resources by same file name", () => {
		const files = [{ path: "/画布B/images/cat.png", fileName: "cat.png", fileId: "other-cat" }]
		expect(
			checkProjectReferenceResourceDrop({
				isDropEnabled: true,
				files,
				matchableItems: [{ path: "./images/cat.png" }],
				currentReferenceFiles: [],
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual({ accepted: false, status: "not-available" })
	})

	it("stores accepted cross-canvas project drops as workspace-absolute paths", () => {
		const files = [{ path: "/画布B/images/cat.png", fileName: "cat.png", fileId: "other-cat" }]
		const normalized = normalizeProjectDropFilesForStorage(files, {
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(normalized).toEqual(files)
	})

	it("stores a single project-root file as a workspace-absolute path", () => {
		const files = [{ path: "/cat.png", fileName: "cat.png", fileId: "project-root-cat" }]
		const normalized = normalizeProjectDropFilesForStorage(files, {
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(normalized).toEqual(files)
	})

	it("treats a drag workspace path as workspace-root, never as current-canvas shorthand", () => {
		const files = [{ path: "images/cat.png", fileName: "cat.png" }]
		expect(
			checkProjectReferenceResourceDrop({
				isDropEnabled: true,
				files,
				matchableItems: [{ path: "./images/cat.png" }],
				currentReferenceFiles: [],
				resolveResourceReference: resolveDesignAResourceReference,
			}).accepted,
		).toBe(false)
	})

	it("lets fileId override a stale drag path before storage", () => {
		const normalized = normalizeProjectDropFilesForStorage(
			[
				{
					path: "/画布B/images/cat.png",
					fileName: "cat.png",
					fileId: "current-cat",
				},
			],
			{ resolveResourceReference: resolveDesignAResourceReference },
		)

		expect(normalized).toEqual([
			{
				path: "./images/cat.png",
				fileName: "cat.png",
				fileId: "current-cat",
			},
		])
	})

	it("fails closed when attachment evidence is not ready", () => {
		const pendingResolver = createTestResourceReferenceResolver({ attachmentsReady: false })
		expect(
			checkProjectReferenceResourceDrop({
				isDropEnabled: true,
				files: [{ path: "/画布A/images/cat.png", fileName: "cat.png", fileId: "pending" }],
				matchableItems: [{ path: "./images/cat.png" }],
				currentReferenceFiles: [],
				resolveResourceReference: pendingResolver,
			}),
		).toEqual({ accepted: false, status: "not-available" })
	})
})
