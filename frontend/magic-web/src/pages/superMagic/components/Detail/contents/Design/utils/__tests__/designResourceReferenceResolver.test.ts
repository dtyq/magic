import { describe, expect, it } from "vitest"
import type {
	CanvasResourceReferenceResolution,
	ResolvedCanvasResourceReference,
} from "@/components/CanvasDesign/public/resource-reference"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { buildDesignAttachmentIndex } from "../designAttachmentIndex"
import {
	buildDesignResourceReferenceResolverRevision,
	resolveDesignCanvasResourceFileItem,
	resolveDesignCanvasResourceApiUri,
	resolveDesignCanvasResourceWorkspacePath,
	resolveDesignResourceReference,
	resolveDesignWorkspaceDirectoryApiPath,
	resolveDesignWorkspaceStoragePath,
	type DesignResourceReferenceResolverContext,
} from "../designResourceReferenceResolver"

const DESIGN_A = "画布A"
const DESIGN_B = "画布B"

function fileItem(
	fileId: string,
	relativeFilePath: string,
	options?: { source?: number },
): FileItem {
	const fileName = relativeFilePath.split("/").pop() ?? ""
	return {
		file_id: fileId,
		file_name: fileName,
		relative_file_path: relativeFilePath,
		file_extension: fileName.split(".").pop() ?? "",
		is_directory: false,
		source: options?.source as FileItem["source"],
	}
}

function context(
	files?: FileItem[],
	attachmentsReady?: boolean,
): DesignResourceReferenceResolverContext {
	return {
		designProjectBasePath: DESIGN_A,
		flatAttachments: files,
		attachmentIndex: files ? buildDesignAttachmentIndex(files) : undefined,
		attachmentsReady,
	}
}

function expectResolved(
	resolution: CanvasResourceReferenceResolution,
): asserts resolution is ResolvedCanvasResourceReference {
	if (resolution.status !== "resolved") {
		throw new Error(`Expected resolved reference, received ${resolution.status}`)
	}
}

describe("designResourceReferenceResolver", () => {
	it("preserves opaque asset references for generation API URIs", () => {
		const result = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "asset://virtual-human-asset-id" },
			context(),
		)

		expect(result).toMatchObject({
			status: "resolved",
			resourceKind: "opaque-asset",
			storagePath: "asset://virtual-human-asset-id",
			assetId: "virtual-human-asset-id",
			identity: "opaque-asset:asset://virtual-human-asset-id",
		})
		expect(resolveDesignCanvasResourceApiUri("asset://virtual-human-asset-id", context())).toBe(
			"asset://virtual-human-asset-id",
		)
		expect(
			resolveDesignCanvasResourceWorkspacePath("asset://virtual-human-asset-id", context()),
		).toBeUndefined()
	})

	it.each([
		"asset://",
		"asset:/virtual-human-asset-id",
		"asset://virtual-human-asset-id/variant",
		"asset://virtual-human-asset-id?version=1",
		"asset://virtual-human-asset-id#preview",
	])("rejects malformed asset references without workspace fallback: %s", (path) => {
		const result = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path },
			context(),
		)

		expect(result).toMatchObject({
			status: "invalid",
			reason: "invalid-asset-reference",
		})
		expect(resolveDesignCanvasResourceApiUri(path, context())).toBeUndefined()
		expect(resolveDesignCanvasResourceWorkspacePath(path, context())).toBeUndefined()
	})

	it("builds a project/canvas-scoped resolver revision from identity semantics only", () => {
		const firstIndex = buildDesignAttachmentIndex([
			{
				...fileItem("file-a", `${DESIGN_A}/images/x.png`),
				updated_at: "2026-08-01",
				file_size: 100,
			},
		])
		const metadataOnlyIndex = buildDesignAttachmentIndex([
			{
				...fileItem("file-a", `${DESIGN_A}/images/x.png`),
				updated_at: "2026-08-05",
				file_size: 200,
			},
		])
		const baseContext = {
			projectId: "project-a",
			designProjectId: "design-a",
			designProjectBasePath: DESIGN_A,
			attachmentsReady: true,
			resourceReferenceSnapshotKey: firstIndex.resourceReferenceSnapshotKey,
		}
		const revision = buildDesignResourceReferenceResolverRevision(baseContext)
		const emptyAttachmentRevision = buildDesignResourceReferenceResolverRevision({
			...baseContext,
			resourceReferenceSnapshotKey: buildDesignAttachmentIndex([])
				.resourceReferenceSnapshotKey,
		})

		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				resourceReferenceSnapshotKey: metadataOnlyIndex.resourceReferenceSnapshotKey,
			}),
		).toBe(revision)
		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				attachmentsReady: false,
			}),
		).not.toBe(revision)
		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				designProjectBasePath: DESIGN_B,
			}),
		).not.toBe(revision)
		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				projectId: "project-b",
			}),
		).not.toBe(revision)
		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				resourceReferenceSnapshotKey: buildDesignAttachmentIndex([
					fileItem("file-b", `${DESIGN_A}/images/x.png`),
				]).resourceReferenceSnapshotKey,
			}),
		).not.toBe(revision)
		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				resourceReferenceSnapshotKey: buildDesignAttachmentIndex([
					fileItem("file-a", `${DESIGN_A}/images/y.png`),
				]).resourceReferenceSnapshotKey,
			}),
		).not.toBe(revision)
		expect(revision).not.toBe(emptyAttachmentRevision)
		expect(
			buildDesignResourceReferenceResolverRevision({
				...baseContext,
				resourceReferenceSnapshotKey: buildDesignAttachmentIndex([])
					.resourceReferenceSnapshotKey,
			}),
		).toBe(emptyAttachmentRevision)
	})

	it.each([
		{
			name: "current-canvas storage path",
			input: { namespace: "canvas-storage", path: "./images/x.png" } as const,
			workspacePath: `/${DESIGN_A}/images/x.png`,
			storagePath: "./images/x.png",
			identity: `workspace:/${DESIGN_A}/images/x.png`,
		},
		{
			name: "current-canvas workspace absolute alias",
			input: { namespace: "canvas-storage", path: `/${DESIGN_A}/images/x.png` } as const,
			workspacePath: `/${DESIGN_A}/images/x.png`,
			storagePath: "./images/x.png",
			identity: `workspace:/${DESIGN_A}/images/x.png`,
		},
		{
			name: "workspace-root image",
			input: { namespace: "canvas-storage", path: "/images/x.png" } as const,
			workspacePath: "/images/x.png",
			storagePath: "/images/x.png",
			identity: "workspace:/images/x.png",
		},
		{
			name: "another canvas image",
			input: { namespace: "canvas-storage", path: `/${DESIGN_B}/images/x.png` } as const,
			workspacePath: `/${DESIGN_B}/images/x.png`,
			storagePath: `/${DESIGN_B}/images/x.png`,
			identity: `workspace:/${DESIGN_B}/images/x.png`,
		},
	])("resolves $name without requiring the attachment snapshot", (testCase) => {
		const resolution = resolveDesignResourceReference(testCase.input, context(undefined, false))
		expectResolved(resolution)

		expect(resolution).toMatchObject({
			workspacePath: testCase.workspacePath,
			storagePath: testCase.storagePath,
			identity: testCase.identity,
			legacyRecovered: false,
		})
	})

	it("treats workspace paths as workspace-root anchored even when they start with a resource dir", () => {
		const resolution = resolveDesignResourceReference(
			{ namespace: "workspace-path", path: "images/x.png" },
			context(),
		)
		expectResolved(resolution)

		expect(resolution.workspacePath).toBe("/images/x.png")
		expect(resolution.storagePath).toBe("/images/x.png")
	})

	it("normalizes output directories through the workspace resolver", () => {
		expect(
			resolveDesignWorkspaceDirectoryApiPath(
				"///画布A//videos///",
				context(undefined, false),
			),
		).toBe("/画布A/videos/")
		expect(
			resolveDesignWorkspaceDirectoryApiPath("../videos", context(undefined, false)),
		).toBeUndefined()
	})

	it("proves current-canvas aliases through the canonical identity", () => {
		const relative = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			context(),
		)
		const absolute = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: `/${DESIGN_A}/images/x.png` },
			context(),
		)
		expectResolved(relative)
		expectResolved(absolute)

		expect(relative.identity).toBe(absolute.identity)
		expect(relative.identity).not.toBe("workspace:/images/x.png")
	})

	it("recovers a legacy bare path only from unique attachment evidence", () => {
		const currentCanvasFile = fileItem("current", `${DESIGN_A}/images/x.png`)
		const resolution = resolveDesignResourceReference(
			{
				namespace: "canvas-storage",
				path: "images/x.png",
				mode: "legacy-recovery",
			},
			context([currentCanvasFile], true),
		)
		expectResolved(resolution)

		expect(resolution).toMatchObject({
			workspacePath: `/${DESIGN_A}/images/x.png`,
			storagePath: "./images/x.png",
			attachmentId: "current",
			legacyRecovered: true,
			resolutionSource: "legacy-recovery",
		})
		expect(resolution.candidates).toEqual([`/${DESIGN_A}/images/x.png`, "/images/x.png"])
	})

	it("rejects a legacy bare path in strict mode", () => {
		const resolution = resolveDesignResourceReference(
			{
				namespace: "canvas-storage",
				path: "images/x.png",
				mode: "strict-current-canvas",
			},
			context([fileItem("current", `${DESIGN_A}/images/x.png`)], true),
		)

		expect(resolution).toMatchObject({
			status: "invalid",
			reason: "legacy-path-requires-recovery",
			candidates: [],
		})
	})

	it("recovers a legacy bare path to workspace root when attachment evidence proves it", () => {
		const rootFile = fileItem("root", "images/x.png")
		const resolution = resolveDesignResourceReference(
			{
				namespace: "canvas-storage",
				path: "images/x.png",
				mode: "legacy-recovery",
			},
			context([rootFile], true),
		)
		expectResolved(resolution)

		expect(resolution.workspacePath).toBe("/images/x.png")
		expect(resolution.storagePath).toBe("/images/x.png")
		expect(resolution.attachmentId).toBe("root")
	})

	it("fails closed when legacy candidates point to different attachment nodes", () => {
		const resolution = resolveDesignResourceReference(
			{
				namespace: "canvas-storage",
				path: "images/x.png",
				mode: "legacy-recovery",
			},
			context(
				[fileItem("current", `${DESIGN_A}/images/x.png`), fileItem("root", "images/x.png")],
				true,
			),
		)

		expect(resolution).toMatchObject({
			status: "ambiguous",
			attachmentIds: undefined,
			candidates: [`/${DESIGN_A}/images/x.png`, "/images/x.png"],
		})
	})

	it("waits for attachments instead of guessing a legacy bare path", () => {
		const resolution = resolveDesignResourceReference(
			{
				namespace: "canvas-storage",
				path: "images/x.png",
				mode: "legacy-recovery",
			},
			context(undefined, false),
		)

		expect(resolution.status).toBe("attachments-pending")
	})

	it("supports explicit attachment requirements for otherwise unambiguous strict paths", () => {
		const pending = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			context(undefined, false),
			{ requireAttachment: true },
		)
		const missing = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			context([], true),
			{ requireAttachment: true },
		)
		const found = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			context([fileItem("current", `${DESIGN_A}/images/x.png`)], true),
			{ requireAttachment: true },
		)

		expect(pending.status).toBe("attachments-pending")
		expect(missing.status).toBe("not-found")
		expectResolved(found)
		expect(found.attachmentId).toBe("current")
	})

	it("uses the flat attachment snapshot when no prebuilt index is available", () => {
		const resolution = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			{
				designProjectBasePath: DESIGN_A,
				flatAttachments: [fileItem("current", `${DESIGN_A}/images/x.png`)],
				attachmentsReady: true,
			},
		)
		expectResolved(resolution)

		expect(resolution.attachmentId).toBe("current")
	})

	it("fails closed when the attachment index contains different nodes at one workspace path", () => {
		const files = [
			fileItem("first", `${DESIGN_A}/images/x.png`),
			fileItem("second", `/${DESIGN_A}/images/x.png`),
		]
		const resolution = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			context(files, true),
		)

		expect(resolution).toMatchObject({
			status: "ambiguous",
			candidates: [`/${DESIGN_A}/images/x.png`],
			attachmentIds: ["first", "second"],
		})
	})

	it("fails closed without a prebuilt index when one workspace path has different nodes", () => {
		const files = [
			fileItem("first", `${DESIGN_A}/images/x.png`),
			fileItem("second", `/${DESIGN_A}/images/x.png`),
		]
		const resolution = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: "./images/x.png" },
			{
				designProjectBasePath: DESIGN_A,
				flatAttachments: files,
				attachmentsReady: true,
			},
		)

		expect(resolution).toMatchObject({
			status: "ambiguous",
			candidates: [`/${DESIGN_A}/images/x.png`],
			attachmentIds: ["first", "second"],
		})
	})

	it("uses fileId as authoritative drag evidence and preserves source", () => {
		const resolution = resolveDesignResourceReference(
			{
				namespace: "attachment",
				fileId: "file-a",
				source: 2,
			},
			context([fileItem("file-a", `${DESIGN_A}/images/x.png`, { source: 1 })], true),
		)
		expectResolved(resolution)

		expect(resolution).toMatchObject({
			workspacePath: `/${DESIGN_A}/images/x.png`,
			storagePath: "./images/x.png",
			attachmentId: "file-a",
			source: 2,
			resolutionSource: "attachment-id",
		})
	})

	it("resolves legacy single-segment file IDs through the attachment index", () => {
		const fileId = "911343142164795393"
		const resolution = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: fileId },
			context([fileItem(fileId, `${DESIGN_A}/images/x.png`)], true),
		)
		expectResolved(resolution)

		expect(resolution.workspacePath).toBe(`/${DESIGN_A}/images/x.png`)
		expect(resolution.attachmentId).toBe(fileId)
	})

	it("keeps external identities outside workspace path semantics", () => {
		const resolution = resolveDesignResourceReference(
			{ namespace: "external-url", url: "https://cdn.example.com/x.png?version=1" },
			context(),
		)
		expectResolved(resolution)

		expect(resolution).toMatchObject({
			resourceKind: "external",
			storagePath: "https://cdn.example.com/x.png?version=1",
			identity: "external:https://cdn.example.com/x.png?version=1",
		})
		expect(resolution.workspacePath).toBeUndefined()
	})

	it("keeps private upload paths outside workspace and current-canvas semantics", () => {
		const relative = resolveDesignResourceReference(
			{ namespace: "private-upload-path", path: "design-mark/mask.png" },
			context(),
		)
		const absoluteAlias = resolveDesignResourceReference(
			{ namespace: "private-upload-path", path: "/design-mark/mask.png" },
			context(),
		)
		expectResolved(relative)
		expectResolved(absoluteAlias)

		expect(relative).toMatchObject({
			resourceKind: "private-upload",
			storagePath: "design-mark/mask.png",
			identity: "private-upload:design-mark/mask.png",
			resolutionSource: "private-upload-path",
		})
		expect(relative.identity).toBe(absoluteAlias.identity)
		expect(relative.workspacePath).toBeUndefined()
	})

	it("rejects private upload path traversal", () => {
		const resolution = resolveDesignResourceReference(
			{ namespace: "private-upload-path", path: "../secret.png" },
			context(),
		)

		expect(resolution).toMatchObject({ status: "invalid", reason: "path-traversal" })
	})

	it("rejects path traversal instead of normalizing it into another resource", () => {
		const resolution = resolveDesignResourceReference(
			{ namespace: "workspace-path", path: `${DESIGN_A}/images/../secret.png` },
			context(),
		)

		expect(resolution).toMatchObject({ status: "invalid", reason: "path-traversal" })
	})

	it("keeps identity stable across workspace-to-storage round trips", () => {
		const workspace = resolveDesignResourceReference(
			{ namespace: "workspace-path", path: `/${DESIGN_A}/images/x.png` },
			context(),
		)
		expectResolved(workspace)

		const restored = resolveDesignResourceReference(
			{ namespace: "canvas-storage", path: workspace.storagePath },
			context(),
		)
		expectResolved(restored)

		expect(restored.identity).toBe(workspace.identity)
		expect(restored.workspacePath).toBe(workspace.workspacePath)
	})

	it("derives API and storage paths from the same resolver contract", () => {
		expect(resolveDesignCanvasResourceWorkspacePath("./images/x.png", context())).toBe(
			`/${DESIGN_A}/images/x.png`,
		)
		expect(resolveDesignCanvasResourceWorkspacePath("/images/x.png", context())).toBe(
			"/images/x.png",
		)
		expect(resolveDesignWorkspaceStoragePath(`/${DESIGN_A}/images/x.png`, context())).toBe(
			"./images/x.png",
		)
	})

	it("stores nested current-canvas workspace results without collapsing workspace-root files", () => {
		const nestedContext = {
			designProjectBasePath: "新建文件夹/123/wrapper/新建画布",
		}

		expect(
			resolveDesignWorkspaceStoragePath(
				"/新建文件夹/123/wrapper/新建画布/images/x.png",
				nestedContext,
			),
		).toBe("./images/x.png")
		expect(resolveDesignWorkspaceStoragePath("/images/x.png", nestedContext)).toBe(
			"/images/x.png",
		)
	})

	it("returns the exact attachment node for a Canvas storage alias", () => {
		const files = [
			fileItem("current", `${DESIGN_A}/images/x.png`),
			fileItem("root", "images/x.png"),
		]

		expect(
			resolveDesignCanvasResourceFileItem("./images/x.png", context(files, true))?.file_id,
		).toBe("current")
		expect(
			resolveDesignCanvasResourceFileItem("/images/x.png", context(files, true))?.file_id,
		).toBe("root")
	})
})
