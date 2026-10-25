import type { ElementDetailsProvenance } from "@/components/CanvasDesign/runtime/document/elementDetailsProvenance"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignData } from "../types"
import type { DesignAttachmentIndex } from "./designAttachmentIndex"
import {
	getHydratedElementDetailsProvenance,
	hydrateDesignDataDetails,
	type ElementDetailsContext,
} from "./elementDetailsIo"
import {
	upgradeDesignDataToV3,
	validateV3CanvasDocument,
	type DesignDataCodecInput,
} from "./designDataCodec"
import {
	normalizeDesignDataPathsAfterLoad,
	parseMagicProjectJsContentWithDiagnostics,
} from "./utils"
import {
	MAGIC_PROJECT_VERSION_V1,
	MAGIC_PROJECT_VERSION_V2,
	MAGIC_PROJECT_VERSION_V3,
} from "./magicProjectCompression"
import { stringifyUnknownError } from "@/utils/error"

export type DesignDataRuntimeSource =
	| { content: string; designData?: never }
	| { content?: never; designData: DesignData | DesignDataCodecInput }

export interface DesignDataRuntimePathContext {
	projectBasePath?: string
	flatAttachments?: FileItem[]
	attachmentIndex?: DesignAttachmentIndex | null
}

export type DesignLoadStage =
	| "parse-envelope"
	| "decompress-canvas"
	| "migrate-elements"
	| "hydrate-sidecar"
	| "normalize-paths"
	| "validate-v3"

export type DesignLoadIssueKind =
	| "invalid-envelope"
	| "decompress-failed"
	| "migration-failed"
	| "validation-failed"
	| "unsupported-sidecar"
	| "sidecar-persist-failed"

export interface DesignLoadIssue {
	kind: DesignLoadIssueKind
	stage: DesignLoadStage
	message: string
	sourceVersion?: string
	fileId?: string
}

export type DesignSidecarStatus = "loaded" | "skipped-history" | "missing" | "unsupported"

export class DesignLoadError extends Error {
	readonly issue: DesignLoadIssue

	constructor(issue: DesignLoadIssue) {
		super(issue.message)
		this.name = "DesignLoadError"
		this.issue = issue
	}
}

export type LoadDesignDataToRuntimeOptions = DesignDataRuntimeSource & {
	/** 主文件与 sidecar 上下文；Draft 等已经包含完整数据的来源不传。 */
	elementDetailsContext?: ElementDetailsContext
	pathContext?: DesignDataRuntimePathContext
	/** 首次加载时用真实目录名覆盖信封中的历史名称。 */
	nameOverride?: string
	/** 历史版本只使用主文件，禁止与当前 sidecar 组合。 */
	sidecarMode?: "current" | "none"
	fileId?: string
}

export interface LoadDesignDataToRuntimeResult {
	data: DesignData
	elementDetailsProvenance?: ElementDetailsProvenance
	/** 数据进入 codec 前的信封版本。Runtime 中的 data.version 始终为 v3。 */
	sourceVersion: string
	didUpgrade: boolean
	/** 仅远端合法 v1/v2 主文件需要自动回写；Draft/History 不在这里触发持久化。 */
	needsPersist: boolean
	issue?: DesignLoadIssue
	sidecarStatus: DesignSidecarStatus
}

/**
 * 数据进入 Canvas Runtime 前的唯一编排入口。
 *
 * 负责解析或克隆升级、sidecar 回填、路径标准化和最终 v3 校验；Runtime 不参与版本判断。
 */
export async function loadDesignDataToRuntime(
	options: LoadDesignDataToRuntimeOptions,
): Promise<LoadDesignDataToRuntimeResult> {
	const isEnvelopeSource = typeof options.content === "string"
	const diagnostics = isEnvelopeSource
		? parseMagicProjectJsContentWithDiagnostics(options.content)
		: null

	if (isEnvelopeSource && !diagnostics?.data) {
		const issueKind: DesignLoadIssueKind =
			diagnostics?.canvasStatus === "decompress-failed"
				? "decompress-failed"
				: "invalid-envelope"
		const issue: DesignLoadIssue = {
			kind: issueKind,
			stage:
				diagnostics?.canvasStatus === "decompress-failed"
					? "decompress-canvas"
					: "parse-envelope",
			message:
				diagnostics?.error ??
				`Invalid magic.project.js canvas (${diagnostics?.canvasStatus ?? "unknown"})`,
			sourceVersion: diagnostics?.sourceVersion,
			fileId: options.fileId,
		}
		throw new DesignLoadError(issue)
	}

	let data: DesignData
	try {
		data = isEnvelopeSource
			? upgradeDesignDataToV3(diagnostics!.data!)
			: upgradeDesignDataToV3(options.designData)
	} catch (error) {
		throw new DesignLoadError({
			kind: "migration-failed",
			stage: "migrate-elements",
			message: stringifyUnknownError(error),
			sourceVersion: isEnvelopeSource
				? diagnostics?.sourceVersion
				: options.designData.version,
			fileId: options.fileId,
		})
	}

	const rawSourceVersion = isEnvelopeSource
		? (diagnostics?.sourceVersion ?? data.version)
		: options.designData.version
	const sourceVersion =
		typeof rawSourceVersion === "string" ? rawSourceVersion : MAGIC_PROJECT_VERSION_V3
	const didUpgrade = sourceVersion !== MAGIC_PROJECT_VERSION_V3
	const needsPersist =
		isEnvelopeSource &&
		(diagnostics?.canvasStatus === "valid-empty" ||
			diagnostics?.canvasStatus === "valid-non-empty") &&
		(sourceVersion === MAGIC_PROJECT_VERSION_V1 || sourceVersion === MAGIC_PROJECT_VERSION_V2)

	if (options.nameOverride) data.name = options.nameOverride

	let elementDetailsProvenance: ElementDetailsProvenance | undefined
	let sidecarStatus: DesignSidecarStatus = "missing"
	let issue: DesignLoadIssue | undefined
	if (options.sidecarMode === "none") {
		sidecarStatus = "skipped-history"
		elementDetailsProvenance = getHydratedElementDetailsProvenance(data)
	} else if (options.elementDetailsContext) {
		try {
			const hydrated = await hydrateDesignDataDetails(data, options.elementDetailsContext)
			elementDetailsProvenance = hydrated.provenance
			sidecarStatus = hydrated.status
			if (sidecarStatus === "unsupported") {
				issue = {
					kind: "unsupported-sidecar",
					stage: "hydrate-sidecar",
					message: "Unsupported element details sidecar structure",
					sourceVersion,
					fileId: options.fileId,
				}
			}
		} catch (error) {
			if (error instanceof DesignLoadError) throw error
			throw new DesignLoadError({
				kind: "unsupported-sidecar",
				stage: "hydrate-sidecar",
				message: stringifyUnknownError(error),
				sourceVersion,
				fileId: options.fileId,
			})
		}
	} else {
		elementDetailsProvenance = getHydratedElementDetailsProvenance(data)
		sidecarStatus = "missing"
	}

	try {
		normalizeDesignDataPathsAfterLoad(data, options.pathContext?.projectBasePath, {
			flatAttachments: options.pathContext?.flatAttachments,
			attachmentIndex: options.pathContext?.attachmentIndex,
		})
	} catch (error) {
		throw new DesignLoadError({
			kind: "migration-failed",
			stage: "normalize-paths",
			message: stringifyUnknownError(error),
			sourceVersion,
			fileId: options.fileId,
		})
	}
	try {
		if (!data.canvas || !Array.isArray(data.canvas.elements)) {
			throw new Error("Canvas elements must be an array")
		}
		validateV3CanvasDocument(data.canvas)
	} catch (error) {
		throw new DesignLoadError({
			kind: "validation-failed",
			stage: "validate-v3",
			message: stringifyUnknownError(error),
			sourceVersion,
			fileId: options.fileId,
		})
	}

	return {
		data,
		elementDetailsProvenance,
		sourceVersion,
		didUpgrade,
		needsPersist,
		issue,
		sidecarStatus,
	}
}
