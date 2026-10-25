import { SuperMagicApi } from "@/apis"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { isEqual } from "lodash-es"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignData } from "../types"
import {
	buildInlineElementDetailsProvenance,
	type ElementDetailsProvenance,
} from "@/components/CanvasDesign/runtime/document/elementDetailsProvenance"
import { isContentProjectVersion } from "./magicProjectCompression"
import {
	ELEMENT_DETAILS_FILENAME,
	ELEMENT_DETAILS_USER_FILENAME,
	type ElementDetailsDoc,
	buildUserElementDetailsDoc,
	emptyElementDetailsDoc,
	hasUnsupportedElementDetailsStructure,
	normalizeElementDetailsDoc,
	rehydrateHeavyFields,
} from "./elementDetailsStore"
import { validateV3CanvasDocument } from "./designDataCodec"

interface SiblingFileLookup {
	fileItem: FileItem | null
	parentId: string | null
}

const hydratedElementDetailsProvenance = new WeakMap<object, ElementDetailsProvenance>()

export function getHydratedElementDetailsProvenance(
	designData: DesignData | null | undefined,
): ElementDetailsProvenance | undefined {
	return designData ? hydratedElementDetailsProvenance.get(designData) : undefined
}

export function setHydratedElementDetailsProvenance(
	designData: DesignData,
	provenance: ElementDetailsProvenance,
): void {
	hydratedElementDetailsProvenance.set(designData, provenance)
}

export function transferHydratedElementDetailsProvenance(from: DesignData, to: DesignData): void {
	const provenance = getHydratedElementDetailsProvenance(from)
	if (provenance) {
		setHydratedElementDetailsProvenance(to, provenance)
	}
}

function flattenFileItems(files: FileItem[] | undefined): FileItem[] {
	if (!files?.length) return []
	return files.flatMap((file) => [file, ...flattenFileItems(file.children)])
}

function isContentDesignData(designData: DesignData | null | undefined): boolean {
	return isContentProjectVersion(designData?.version)
}

function isElementDetailsContentEqual(left: ElementDetailsDoc, right: ElementDetailsDoc): boolean {
	// 1.0.0 与 1.1.0 只在 schema version 上不同；兼容读取时不应为了版本号单独写回 sidecar。
	return isEqual(left.elements, right.elements)
}

/**
 * 在主文件同级目录下定位 sidecar 文件，并返回其所在目录 id（用于创建新文件）。
 */
function findSiblingFile(
	attachments: FileItem[] | undefined,
	flatAttachments: FileItem[] | undefined,
	mainFileId: string | null,
	targetFileName: string,
): SiblingFileLookup {
	const all = [...(flatAttachments ?? []), ...flattenFileItems(attachments)]
	if (!mainFileId || all.length === 0) {
		return { fileItem: null, parentId: null }
	}

	const mainFile = all.find((item) => item.file_id === mainFileId)
	const parentId =
		(mainFile as (FileItem & { parent_id?: string }) | undefined)?.parent_id ?? null

	if (parentId) {
		const sibling = all.find(
			(item) =>
				item.file_name === targetFileName &&
				String((item as FileItem & { parent_id?: string }).parent_id ?? "") ===
					String(parentId),
		)
		if (sibling) return { fileItem: sibling, parentId }
	}

	return { fileItem: null, parentId }
}

interface ReadElementDetailsResult {
	doc: ElementDetailsDoc
	exists: boolean
	unsupported: boolean
}

function readElementDetailsFileContent(
	fileId: string,
	fileApi?: FileApi,
): Promise<string | ArrayBuffer | Blob> {
	// Bound FileApi forwarding share/session identity; host-only callers fall back
	// to the unbound leaf (session identity is the intentional default there).
	return fileApi
		? fileApi.getFileContentById(fileId, { responseType: "text" })
		: getFileContentById(fileId, { responseType: "text" })
}

async function readElementDetailsByFile(
	fileItem: FileItem | null,
	fileApi?: FileApi,
): Promise<ReadElementDetailsResult> {
	if (!fileItem?.file_id)
		return { doc: emptyElementDetailsDoc(), exists: false, unsupported: false }
	try {
		const content = (await readElementDetailsFileContent(fileItem.file_id, fileApi)) as
			string | null
		if (!content || !content.trim())
			return { doc: emptyElementDetailsDoc(), exists: true, unsupported: false }
		const raw = JSON.parse(content)
		return {
			doc: normalizeElementDetailsDoc(raw),
			exists: true,
			unsupported: hasUnsupportedElementDetailsStructure(raw),
		}
	} catch {
		return { doc: emptyElementDetailsDoc(), exists: true, unsupported: false }
	}
}

export interface ElementDetailsContext {
	attachments?: FileItem[]
	flatAttachments?: FileItem[]
	mainFileId: string | null
	projectId?: string
	/** Bound file client injected at the Design boundary; omitted on host-only paths. */
	fileApi?: FileApi
}

export interface HydrateElementDetailsResult {
	provenance: ElementDetailsProvenance
	status: "loaded" | "missing" | "unsupported"
}

export async function getElementDetailsSidecarStatus(
	ctx: ElementDetailsContext,
): Promise<"loaded" | "missing" | "unsupported"> {
	const agentLookup = findSiblingFile(
		ctx.attachments,
		ctx.flatAttachments,
		ctx.mainFileId,
		ELEMENT_DETAILS_FILENAME,
	)
	const userLookup = findSiblingFile(
		ctx.attachments,
		ctx.flatAttachments,
		ctx.mainFileId,
		ELEMENT_DETAILS_USER_FILENAME,
	)
	const [agentResult, userResult] = await Promise.all([
		readElementDetailsByFile(agentLookup.fileItem, ctx.fileApi),
		readElementDetailsByFile(userLookup.fileItem, ctx.fileApi),
	])
	if (agentResult.unsupported || userResult.unsupported) return "unsupported"
	return agentResult.exists || userResult.exists ? "loaded" : "missing"
}

/**
 * v3 项目：把两个 sidecar 的重字段回填到 Content 上（原地）。
 * 非 v3 数据由主数据 codec 先升级后再进入这里。
 */
export async function hydrateDesignDataDetails(
	designData: DesignData | null,
	ctx: ElementDetailsContext,
): Promise<HydrateElementDetailsResult> {
	if (!designData) return { provenance: {}, status: "missing" }
	const elements = designData.canvas?.elements
	if (!isContentDesignData(designData)) {
		const inlineProvenance = buildInlineElementDetailsProvenance(elements ?? [])
		setHydratedElementDetailsProvenance(designData, inlineProvenance)
		return { provenance: inlineProvenance, status: "missing" }
	}

	const agentLookup = findSiblingFile(
		ctx.attachments,
		ctx.flatAttachments,
		ctx.mainFileId,
		ELEMENT_DETAILS_FILENAME,
	)
	const userLookup = findSiblingFile(
		ctx.attachments,
		ctx.flatAttachments,
		ctx.mainFileId,
		ELEMENT_DETAILS_USER_FILENAME,
	)

	const [agentResult, userResult] = await Promise.all([
		readElementDetailsByFile(agentLookup.fileItem, ctx.fileApi),
		readElementDetailsByFile(userLookup.fileItem, ctx.fileApi),
	])
	if (agentResult.unsupported || userResult.unsupported) {
		setHydratedElementDetailsProvenance(designData, {})
		return { provenance: {}, status: "unsupported" }
	}
	if (!elements?.length) {
		setHydratedElementDetailsProvenance(designData, {})
		return {
			provenance: {},
			status: agentResult.exists || userResult.exists ? "loaded" : "missing",
		}
	}

	const provenance = rehydrateHeavyFields(elements, userResult.doc, agentResult.doc)
	validateV3CanvasDocument(designData.canvas)
	setHydratedElementDetailsProvenance(designData, provenance)
	return {
		provenance,
		status: agentResult.exists || userResult.exists ? "loaded" : "missing",
	}
}

/**
 * v3 项目：只写 element-details-user.json。
 * agent 来源 Content 排除；画布新建写入 user 文件。永不写 element-details.json。
 */
export async function writeUserElementDetails(
	designData: DesignData,
	ctx: ElementDetailsContext,
	provenance?: ElementDetailsProvenance,
): Promise<"persisted" | "unchanged" | "skipped" | "blocked-unsupported" | "failed"> {
	if (!isContentDesignData(designData) || !ctx.mainFileId) return "skipped"

	const resolvedProvenance = provenance ?? getHydratedElementDetailsProvenance(designData) ?? {}

	const agentLookup = findSiblingFile(
		ctx.attachments,
		ctx.flatAttachments,
		ctx.mainFileId,
		ELEMENT_DETAILS_FILENAME,
	)
	const userLookup = findSiblingFile(
		ctx.attachments,
		ctx.flatAttachments,
		ctx.mainFileId,
		ELEMENT_DETAILS_USER_FILENAME,
	)

	const [agentBaselineResult, userBaselineResult] = await Promise.all([
		readElementDetailsByFile(agentLookup.fileItem, ctx.fileApi),
		readElementDetailsByFile(userLookup.fileItem, ctx.fileApi),
	])
	if (agentBaselineResult.unsupported || userBaselineResult.unsupported)
		return "blocked-unsupported"

	const userDoc = buildUserElementDetailsDoc(
		designData.canvas?.elements,
		resolvedProvenance,
		agentBaselineResult.doc,
	)
	const hasEntries = Object.keys(userDoc.elements).length > 0
	let userFileId = userLookup.fileItem?.file_id ?? null

	if (!userFileId && !hasEntries) return "skipped"

	if (userFileId) {
		if (isElementDetailsContentEqual(userBaselineResult.doc, userDoc)) return "unchanged"
	}

	if (!userFileId) {
		const parentId = userLookup.parentId ?? agentLookup.parentId
		if (!ctx.projectId || !parentId) return "failed"
		try {
			const created = await SuperMagicApi.createFile({
				project_id: ctx.projectId,
				parent_id: parentId,
				file_name: ELEMENT_DETAILS_USER_FILENAME,
				is_directory: false,
				ignore_duplicate: true,
			})
			userFileId = (created as { file_id?: string })?.file_id ?? null
		} catch {
			return "failed"
		}
	}

	if (!userFileId) return "failed"

	try {
		await SuperMagicApi.saveFileContent([
			{
				file_id: userFileId,
				content: JSON.stringify(userDoc, null, 2),
				enable_shadow: true,
			},
		])
		return "persisted"
	} catch {
		return "failed"
	}
}
