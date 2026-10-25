import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type AudioElement,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "../../document/types"
import { updateContent } from "../../document/elementContent"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { IMAGE_CONFIG } from "../../elements/image/ImageElement.config"
import { VIDEO_CONFIG } from "../../elements/video/VideoElement.config"
import { AUDIO_CONFIG } from "../../elements/audio/AudioElement.config"
import {
	generateElementId,
	getFileExtensionFromMimeType,
	getMediaDimensions,
} from "../../shared/ids"
import {
	resolveConnectedPlacement,
	resolveNearestFreeMediaPlacement,
} from "../../shared/placement/placementEngine"
import { createElementFromElementConnection } from "../../interaction/connection/elementConnectionCreation"
import { createSelectionRevision } from "../../interaction/selection/selectionContentCollector"
import { type CanvasAssetMediaType, type UploadFileResponse } from "../../../public/magic-types"
import {
	findCanvasAssetMediaBinding,
	findConnectedCanvasAssetMediaBinding,
	findCanvasWorkspaceMediaFile,
	getAssetUploadSubDir,
	type CanvasAssetMediaBinding,
} from "./assetMediaBinding"
import {
	getRememberedAssetMediaDimensions,
	probeAssetMediaDimensionsFromUrl,
	rememberAssetMediaDimensions,
	type AssetMediaDimensions,
} from "./assetMediaDimensionCache"

export { getAssetUploadSubDir } from "./assetMediaBinding"

export type CanvasAssetImportSlot = { kind: "frame" } | { kind: "reference" }
export type CanvasAssetImportTargetKind = "image-generator" | "video-generator"

interface CanvasAssetImportCommonRequest {
	targetElementId: string
	targetKind: CanvasAssetImportTargetKind
	slot: CanvasAssetImportSlot
	allowedMediaTypes: readonly CanvasAssetMediaType[]
}

export interface CanvasAssetImportRequest extends CanvasAssetImportCommonRequest {
	assetId: string
	/** 可选的会话守卫；资源准备期间编辑器退出时，避免提交过期结果。 */
	isCurrent?: () => boolean
}

export interface CanvasAssetImportManyRequest extends CanvasAssetImportCommonRequest {
	assetIds: readonly string[]
	/** 可选的会话守卫；资源准备期间编辑器退出时，避免提交过期结果。 */
	isCurrent?: () => boolean
}

export interface CanvasAssetImportResult {
	elementId: string
	connectionId: string
	workspacePath: string
	fileName: string
	mediaType: CanvasAssetMediaType
	source: "existing-binding" | "existing-connection" | "existing-file" | "downloaded"
}

export interface CanvasAssetElementImportResult {
	elementId: string
	workspacePath: string
	fileName: string
	mediaType: CanvasAssetMediaType
	source: Exclude<CanvasAssetImportResult["source"], "existing-connection">
}

interface PreparedAssetMedia {
	assetId: string
	mediaType: CanvasAssetMediaType
	workspacePath: string
	fileName: string
	dimensions: { width: number; height: number }
	source: Exclude<CanvasAssetImportResult["source"], "existing-connection">
}

interface AssetMediaDownloadSource {
	assetId: string
	mediaType: CanvasAssetMediaType
	fileUrl: string
	fileName?: string
}

type AssetMediaPreparation =
	| { assetId: string; prepared: PreparedAssetMedia }
	| { assetId: string; pending: Promise<PreparedAssetMedia> }
	| { assetId: string; source: AssetMediaDownloadSource }

const FALLBACK_FILE_EXTENSIONS: Record<CanvasAssetMediaType, string> = {
	image: "png",
	video: "mp4",
	audio: "mp3",
}

const FALLBACK_MIME_TYPES: Record<CanvasAssetMediaType, string> = {
	image: "image/png",
	video: "video/mp4",
	audio: "audio/mpeg",
}

function getElementType(mediaType: CanvasAssetMediaType): LayerElement["type"] {
	if (mediaType === "image") return ElementTypeEnum.Image
	if (mediaType === "video") return ElementTypeEnum.Video
	return ElementTypeEnum.Audio
}

function getFallbackDimensions(mediaType: CanvasAssetMediaType) {
	if (mediaType === "image") {
		return { width: IMAGE_CONFIG.DEFAULT_WIDTH, height: IMAGE_CONFIG.DEFAULT_HEIGHT }
	}
	if (mediaType === "video") {
		return { width: VIDEO_CONFIG.DEFAULT_WIDTH, height: VIDEO_CONFIG.DEFAULT_HEIGHT }
	}
	return { width: AUDIO_CONFIG.DEFAULT_WIDTH, height: AUDIO_CONFIG.DEFAULT_HEIGHT }
}

async function measureFileDimensions(
	file: File,
	mediaType: CanvasAssetMediaType,
): Promise<AssetMediaDimensions | null> {
	if (mediaType === "audio") return null
	try {
		const dimensions = await getMediaDimensions(file)
		return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null
	} catch {
		return null
	}
}

/**
 * 优先用素材预览已经量到的编码尺寸。
 * 预览未完成时再测本地文件或签名地址；都不可用才退回元素默认尺寸。
 */
async function resolveImportedMediaDimensions(options: {
	assetId: string
	mediaType: CanvasAssetMediaType
	file?: File
	fileUrl?: string | null
}): Promise<AssetMediaDimensions> {
	if (options.mediaType === "audio") return getFallbackDimensions(options.mediaType)

	const cached = getRememberedAssetMediaDimensions(options.assetId)
	if (cached) return cached

	const measured = options.file
		? await measureFileDimensions(options.file, options.mediaType)
		: null
	if (measured) {
		rememberAssetMediaDimensions(options.assetId, measured)
		return measured
	}

	if (options.fileUrl) {
		const probed = await probeAssetMediaDimensionsFromUrl(options.fileUrl, options.mediaType)
		if (probed) {
			rememberAssetMediaDimensions(options.assetId, probed)
			return probed
		}
	}

	return getFallbackDimensions(options.mediaType)
}

function getUrlFileName(url: string): string {
	try {
		const pathname = new URL(url).pathname
		return decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1))
	} catch {
		return ""
	}
}

function sanitizeFileNamePart(value: string): string {
	return Array.from(value, (character) => (character.charCodeAt(0) < 32 ? "-" : character))
		.join("")
		.replace(/[<>:"/\\|?*]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
}

function buildAssetFileName(options: {
	assetId: string
	mediaType: CanvasAssetMediaType
	fileName?: string
	fileUrl: string
	mimeType: string
}): string {
	const candidate =
		sanitizeFileNamePart(options.fileName ?? "") ||
		sanitizeFileNamePart(getUrlFileName(options.fileUrl)) ||
		`asset-${sanitizeFileNamePart(options.assetId)}`
	if (/\.[a-z0-9]{1,10}$/i.test(candidate)) return candidate

	const extension =
		getFileExtensionFromMimeType(options.mimeType) ||
		FALLBACK_FILE_EXTENSIONS[options.mediaType]
	return `${candidate}.${extension}`
}

function getAssetFileNameCandidates(options: {
	mediaType: CanvasAssetMediaType
	fileName?: string
	fileUrl?: string | null
}): string[] {
	const candidates = [
		sanitizeFileNamePart(options.fileName ?? ""),
		sanitizeFileNamePart(options.fileUrl ? getUrlFileName(options.fileUrl) : ""),
	].filter(Boolean)
	const fallbackExtension = FALLBACK_FILE_EXTENSIONS[options.mediaType]
	return Array.from(
		new Set(
			candidates.flatMap((candidate) =>
				/\.[a-z0-9]{1,10}$/i.test(candidate)
					? [candidate]
					: [candidate, `${candidate}.${fallbackExtension}`],
			),
		),
	)
}

function getElementName(fileName: string, mediaType: CanvasAssetMediaType): string {
	return fileName.replace(/\.[^/.]+$/, "") || mediaType
}

function normalizeAssetIds(assetIds: readonly string[]): string[] {
	return Array.from(new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)))
}

function getImportPolicyKey(request: CanvasAssetImportCommonRequest): string {
	// A frame import and a reference import can share the same asset, but they
	// have different seed semantics. Keep concurrent promises isolated by the
	// slot and media policy as well as the target element.
	return [
		request.targetElementId,
		request.targetKind,
		request.slot.kind,
		Array.from(new Set(request.allowedMediaTypes)).sort().join(","),
	].join("\u0000")
}

function validateImportRequest(request: CanvasAssetImportCommonRequest): void {
	if (request.allowedMediaTypes.length === 0) {
		throw new Error("No asset media type is allowed for this slot")
	}

	if (
		request.targetKind === "image-generator" &&
		(request.slot.kind !== "reference" ||
			request.allowedMediaTypes.some((mediaType) => mediaType !== "image"))
	) {
		throw new Error("Image generator asset imports only support image references")
	}

	if (
		request.targetKind === "video-generator" &&
		request.slot.kind === "frame" &&
		request.allowedMediaTypes.some((mediaType) => mediaType !== "image")
	) {
		throw new Error("Video frame asset imports only support image media")
	}
}

function assertImportTarget(
	canvas: Canvas,
	targetElementId: string,
	targetKind: CanvasAssetImportTargetKind,
): void {
	const target = canvas.elementManager.getElementData(targetElementId)
	const expectedType =
		targetKind === "image-generator" ? ElementTypeEnum.Image : ElementTypeEnum.Video
	if (target?.type === expectedType) return

	const targetLabel = targetKind === "image-generator" ? "image" : "video"
	throw new Error(`Asset import target ${targetLabel} is unavailable`)
}

/** 将素材服务中的逻辑资源导入当前 Canvas，并创建可参与编辑器关联的媒体元素。 */
export class CanvasAssetImportManager {
	private readonly importPromises = new Map<string, Promise<PreparedAssetMedia>>()
	private readonly connectionPromises = new Map<string, Promise<CanvasAssetImportResult>>()
	private readonly batchConnectionPromises = new Map<string, Promise<CanvasAssetImportResult[]>>()
	private destroyed = false

	constructor(private readonly canvas: Canvas) {}

	public async importAndConnect(
		request: CanvasAssetImportRequest,
	): Promise<CanvasAssetImportResult> {
		const assetId = request.assetId.trim()
		const connectionKey = `${getImportPolicyKey(request)}\u0000${assetId}`
		// A session guard belongs to the caller, so sharing a guarded promise
		// across two editor sessions could let a stale caller cancel a current one.
		const existingConnectionPromise = request.isCurrent
			? undefined
			: this.connectionPromises.get(connectionKey)
		if (existingConnectionPromise) {
			const result = await existingConnectionPromise
			return { ...result, source: "existing-connection" }
		}

		const connectionPromise = this.importAndConnectInternal(request)
		if (!request.isCurrent) this.connectionPromises.set(connectionKey, connectionPromise)
		try {
			return await connectionPromise
		} finally {
			if (
				!request.isCurrent &&
				this.connectionPromises.get(connectionKey) === connectionPromise
			) {
				this.connectionPromises.delete(connectionKey)
			}
		}
	}

	/** 导入素材并在当前画布创建独立媒体元素，不建立编辑器连接。 */
	public async importAndCreateElement(request: {
		assetId: string
		allowedMediaTypes: readonly CanvasAssetMediaType[]
	}): Promise<CanvasAssetElementImportResult> {
		if (this.destroyed) throw new Error("Canvas asset import manager destroyed")
		const assetId = request.assetId.trim()
		if (!assetId) throw new Error("Asset id is required")

		const prepared = await this.prepareAssetMedia(assetId, request.allowedMediaTypes)
		if (this.destroyed) throw new Error("Canvas asset import manager destroyed")

		const position = resolveNearestFreeMediaPlacement(this.canvas, prepared.dimensions)
		const elementId = this.createStandaloneMediaElement(prepared, position)
		if (!elementId) throw new Error("Failed to create an asset media element")

		return {
			elementId,
			workspacePath: prepared.workspacePath,
			fileName: prepared.fileName,
			mediaType: prepared.mediaType,
			source: prepared.source,
		}
	}

	/**
	 * 批量导入素材并建立连接。
	 *
	 * 素材准备可能跨越异步下载和上传，因此只把画布节点与连接放进事务；
	 * 任一节点或连接失败都会回滚本批新建的画布对象，不污染参考图状态。
	 */
	public async importAndConnectMany(
		request: CanvasAssetImportManyRequest,
	): Promise<CanvasAssetImportResult[]> {
		const assetIds = normalizeAssetIds(request.assetIds)
		if (assetIds.length === 0) throw new Error("At least one asset id is required")
		if (request.slot.kind === "frame" && assetIds.length !== 1) {
			throw new Error("A frame asset import accepts exactly one asset")
		}

		const connectionKey = [getImportPolicyKey(request), ...assetIds].join("\u0000")
		// See the single-item path above: guarded calls must keep their own
		// lifecycle instead of sharing a promise with another editor session.
		const existingConnectionPromise = request.isCurrent
			? undefined
			: this.batchConnectionPromises.get(connectionKey)
		if (existingConnectionPromise) {
			const results = await existingConnectionPromise
			return results.map((result) => ({ ...result, source: "existing-connection" }))
		}

		const connectionPromise = this.importAndConnectManyInternal({ ...request, assetIds })
		if (!request.isCurrent) this.batchConnectionPromises.set(connectionKey, connectionPromise)
		try {
			return await connectionPromise
		} finally {
			if (
				!request.isCurrent &&
				this.batchConnectionPromises.get(connectionKey) === connectionPromise
			) {
				this.batchConnectionPromises.delete(connectionKey)
			}
		}
	}

	private async importAndConnectInternal(
		request: CanvasAssetImportRequest,
	): Promise<CanvasAssetImportResult> {
		if (this.destroyed) throw new Error("Canvas asset import manager destroyed")
		const assetId = request.assetId.trim()
		if (!assetId) throw new Error("Asset id is required")
		validateImportRequest(request)
		assertImportTarget(this.canvas, request.targetElementId, request.targetKind)

		const prepared = await this.prepareAssetMedia(assetId, request.allowedMediaTypes)
		if (this.destroyed) throw new Error("Canvas asset import manager destroyed")
		if (request.isCurrent?.() === false) throw new Error("Asset import session is stale")
		assertImportTarget(this.canvas, request.targetElementId, request.targetKind)

		const connected = findConnectedCanvasAssetMediaBinding(this.canvas, {
			assetId,
			targetElementId: request.targetElementId,
			allowedMediaTypes: request.allowedMediaTypes,
		})
		if (connected) {
			return {
				elementId: connected.elementId,
				connectionId: connected.connectionId,
				workspacePath: connected.workspacePath,
				fileName: connected.fileName,
				mediaType: connected.mediaType,
				source: "existing-connection",
			}
		}

		let connectionId: string | null = null
		const elementId = createElementFromElementConnection({
			canvas: this.canvas,
			origin: {
				kind: "element",
				elementId: request.targetElementId,
				side: "left",
			},
			createElement: () => this.createMediaElement(prepared, request.targetElementId),
			afterConnect: (result) => {
				connectionId = result.connectionIds[0] ?? null
				if (request.slot.kind !== "reference") return
				this.canvas.connectionAssociationSeedManager.register({
					targetElementId: request.targetElementId,
					targetKind: request.targetKind,
					rootElementIds: [result.createdElementId],
					orderedSources: [
						{ elementId: result.createdElementId, kind: prepared.mediaType },
					],
					originRevision: createSelectionRevision([result.createdElementId]),
					createdBy: "assets",
					mediaRole: "reference",
				})
			},
		})

		if (!elementId || !connectionId) {
			throw new Error("Failed to create an asset media connection")
		}

		return {
			elementId,
			connectionId,
			workspacePath: prepared.workspacePath,
			fileName: prepared.fileName,
			mediaType: prepared.mediaType,
			source: prepared.source,
		}
	}

	private async importAndConnectManyInternal(
		request: CanvasAssetImportManyRequest & { assetIds: string[] },
	): Promise<CanvasAssetImportResult[]> {
		if (this.destroyed) throw new Error("Canvas asset import manager destroyed")
		validateImportRequest(request)
		assertImportTarget(this.canvas, request.targetElementId, request.targetKind)

		const preparedAssets = await this.prepareAssetMediaBatch(
			request.assetIds,
			request.allowedMediaTypes,
		)
		if (this.destroyed) throw new Error("Canvas asset import manager destroyed")
		if (request.isCurrent?.() === false) throw new Error("Asset import session is stale")
		assertImportTarget(this.canvas, request.targetElementId, request.targetKind)

		const resultsByAssetId = new Map<string, CanvasAssetImportResult>()
		const pendingConnections: PreparedAssetMedia[] = []
		for (const prepared of preparedAssets) {
			const connected = findConnectedCanvasAssetMediaBinding(this.canvas, {
				assetId: prepared.assetId,
				targetElementId: request.targetElementId,
				allowedMediaTypes: request.allowedMediaTypes,
			})
			if (connected) {
				resultsByAssetId.set(prepared.assetId, {
					elementId: connected.elementId,
					connectionId: connected.connectionId,
					workspacePath: connected.workspacePath,
					fileName: connected.fileName,
					mediaType: connected.mediaType,
					source: "existing-connection",
				})
				continue
			}
			pendingConnections.push(prepared)
		}
		if (pendingConnections.length === 0) {
			if (request.isCurrent?.() === false) throw new Error("Asset import session is stale")
			// Already-connected media is selected by the editor's explicit asset
			// insertion (ensurePromptMention). Registering a seed here would insert a
			// second mention under the path-derived file name, which still carries the
			// extension and therefore splits a fresh element-name chip into text.
			return request.assetIds.map((assetId) => {
				const result = resultsByAssetId.get(assetId)
				if (!result) throw new Error("Failed to resolve imported asset media connections")
				return result
			})
		}
		const previousSeed =
			request.slot.kind === "reference"
				? this.canvas.connectionAssociationSeedManager.peek(request.targetElementId)
				: null
		// `register` replaces the previous seed before allocating the new one. Keep
		// an explicit restoration path for a mocked/host implementation that throws
		// after that replacement, so a failed batch cannot consume an older seed.
		const restorePreviousSeed = () => {
			this.canvas.connectionAssociationSeedManager.remove(request.targetElementId)
			if (!previousSeed) return
			const { id: previousSeedId, ...seed } = previousSeed
			void previousSeedId
			this.canvas.connectionAssociationSeedManager.register(seed)
		}

		const createdElements: string[] = []
		let createdConnectionIds: string[] = []
		let registeredSeedId: string | null = null
		const rollbackSeed = () => {
			if (!registeredSeedId) return
			const currentSeed = this.canvas.connectionAssociationSeedManager.peek(
				request.targetElementId,
			)
			if (currentSeed?.id !== registeredSeedId) return
			restorePreviousSeed()
			registeredSeedId = null
		}
		const rollbackCreatedBatch = () => {
			const rollback = () => {
				const connectionIds = new Set(createdConnectionIds)
				// A connection manager may report an invalid batch after partially
				// inserting edges. Include any edge from this batch that was not in
				// the success response before deleting the newly created elements.
				this.canvas.connectionManager
					.getUpstreamConnections(request.targetElementId)
					.forEach((connection) => {
						if (createdElements.includes(connection.sourceElementId)) {
							connectionIds.add(connection.id)
						}
					})
				if (connectionIds.size > 0) {
					this.canvas.connectionManager.removeConnections([...connectionIds], {
						emitChange: false,
					})
				}
				createdElements.forEach((elementId) => {
					if (this.canvas.elementManager.getElementData(elementId)) {
						this.canvas.elementManager.delete(elementId)
					}
				})
			}
			// Rollback after the transaction must not create a second undo step.
			this.canvas.historyManager.runTransaction(rollback, () => false)
		}
		const connectionResult = this.canvas.historyManager.runTransaction(
			() => {
				const rollback = () => {
					const connectionIds = new Set(createdConnectionIds)
					this.canvas.connectionManager
						.getUpstreamConnections(request.targetElementId)
						.forEach((connection) => {
							if (createdElements.includes(connection.sourceElementId)) {
								connectionIds.add(connection.id)
							}
						})
					if (connectionIds.size > 0) {
						this.canvas.connectionManager.removeConnections([...connectionIds], {
							emitChange: false,
						})
					}
					createdElements.forEach((elementId) => {
						if (this.canvas.elementManager.getElementData(elementId)) {
							this.canvas.elementManager.delete(elementId)
						}
					})
				}

				try {
					if (request.isCurrent?.() === false) return null
					for (const prepared of pendingConnections) {
						const elementId = this.createMediaElement(prepared, request.targetElementId)
						if (!elementId) {
							rollback()
							return null
						}
						createdElements.push(elementId)
					}

					const connection = this.canvas.connectionManager.connectElementsBatch({
						edges: createdElements.map((elementId) => ({
							sourceElementId: elementId,
							targetElementId: request.targetElementId,
						})),
					})
					if (
						connection.status !== "created" ||
						connection.connectionIds.length !== createdElements.length ||
						connection.connectionIds.some((connectionId) => !connectionId)
					) {
						rollback()
						return null
					}
					createdConnectionIds = connection.connectionIds
					if (request.isCurrent?.() === false) {
						rollback()
						return null
					}
					return connection
				} catch {
					rollback()
					return null
				}
			},
			(result) => result !== null,
		)

		if (!connectionResult) {
			throw new Error("Failed to create asset media connections")
		}
		if (request.isCurrent?.() === false) {
			rollbackCreatedBatch()
			throw new Error("Asset import session is stale")
		}

		pendingConnections.forEach((prepared, index) => {
			const elementId = createdElements[index]
			const connectionId = createdConnectionIds[index]
			if (!elementId || !connectionId) return
			resultsByAssetId.set(prepared.assetId, {
				elementId,
				connectionId,
				workspacePath: prepared.workspacePath,
				fileName: prepared.fileName,
				mediaType: prepared.mediaType,
				source: prepared.source,
			})
		})

		const results = request.assetIds.map((assetId) => resultsByAssetId.get(assetId))
		if (results.some((result) => !result)) {
			rollbackCreatedBatch()
			throw new Error("Failed to resolve imported asset media connections")
		}
		const resolvedResults = results as CanvasAssetImportResult[]

		try {
			// Only newly created connections need the one-shot seed. Reused bindings
			// are already inserted by the editor's explicit asset insertion.
			registeredSeedId = this.registerReferenceSeed(
				request,
				resolvedResults.filter((result) => result.source !== "existing-connection"),
			)
		} catch (error) {
			// `register` may remove the prior seed before throwing. The normal
			// rollback only has an id after successful registration, so restore the
			// captured seed explicitly on this failure path.
			restorePreviousSeed()
			rollbackCreatedBatch()
			throw error
		}
		if (request.isCurrent?.() === false) {
			rollbackSeed()
			rollbackCreatedBatch()
			throw new Error("Asset import session is stale")
		}

		return resolvedResults
	}

	private registerReferenceSeed(
		request: CanvasAssetImportCommonRequest,
		results: CanvasAssetImportResult[],
	): string | null {
		if (request.slot.kind !== "reference" || results.length === 0) return null

		return this.canvas.connectionAssociationSeedManager.register({
			targetElementId: request.targetElementId,
			targetKind: request.targetKind,
			rootElementIds: results.map((result) => result.elementId),
			orderedSources: results.map((result) => ({
				elementId: result.elementId,
				kind: result.mediaType,
			})),
			originRevision: createSelectionRevision(results.map((result) => result.elementId)),
			createdBy: "assets",
			mediaRole: "reference",
		})
	}

	public destroy(): void {
		this.destroyed = true
		this.importPromises.clear()
		this.connectionPromises.clear()
		this.batchConnectionPromises.clear()
	}

	private async prepareAssetMedia(
		assetId: string,
		allowedMediaTypes: readonly CanvasAssetMediaType[],
	): Promise<PreparedAssetMedia> {
		const preparation = await this.resolveAssetMediaPreparation(assetId, allowedMediaTypes)
		if ("prepared" in preparation) return preparation.prepared
		if ("pending" in preparation) return preparation.pending
		return this.downloadAndUpload(preparation.source)
	}

	private async resolveAssetMediaPreparation(
		assetId: string,
		allowedMediaTypes: readonly CanvasAssetMediaType[],
	): Promise<AssetMediaPreparation> {
		const existing = this.findBinding(assetId, allowedMediaTypes)
		if (existing) return { assetId, prepared: this.fromBinding(existing) }

		const resource = await this.canvas.assetResourceManager.getResource(assetId, {
			forceRefresh: true,
			priority: "critical",
		})
		if (!resource.mediaType || !allowedMediaTypes.includes(resource.mediaType)) {
			throw new Error("Asset media type is not allowed for this slot")
		}

		// 素材详情请求期间可能已有另一个入口完成落图，复用文件或上传前再扫描一次。
		const refreshedBinding = this.findBinding(assetId, allowedMediaTypes)
		if (refreshedBinding) return { assetId, prepared: this.fromBinding(refreshedBinding) }

		for (const fileName of getAssetFileNameCandidates({
			mediaType: resource.mediaType,
			fileName: resource.fileName,
			fileUrl: resource.fileUrl,
		})) {
			const existingFile = findCanvasWorkspaceMediaFile(this.canvas, {
				mediaType: resource.mediaType,
				fileName,
			})
			if (!existingFile) continue
			return {
				assetId,
				prepared: {
					assetId,
					...existingFile,
					dimensions: await resolveImportedMediaDimensions({
						assetId,
						mediaType: resource.mediaType,
						fileUrl: resource.fileUrl,
					}),
					source: "existing-file",
				},
			}
		}

		if (!resource.fileUrl) throw new Error("Asset file URL is unavailable")

		const pending = this.importPromises.get(assetId)
		if (pending) return { assetId, pending }

		return {
			assetId,
			source: {
				assetId,
				mediaType: resource.mediaType,
				fileUrl: resource.fileUrl,
				fileName: resource.fileName,
			},
		}
	}

	/**
	 * Batch imports download assets in parallel, then upload each media directory once.
	 * The result order stays aligned with the selected asset order for connection seeds.
	 */
	private async prepareAssetMediaBatch(
		assetIds: readonly string[],
		allowedMediaTypes: readonly CanvasAssetMediaType[],
	): Promise<PreparedAssetMedia[]> {
		const directResults = new Map<string, PreparedAssetMedia>()
		const pendingResults = new Map<string, Promise<PreparedAssetMedia>>()
		const downloadSourcesByIndex: Array<AssetMediaDownloadSource | undefined> = []

		await Promise.all(
			assetIds.map(async (assetId, index) => {
				const preparation = await this.resolveAssetMediaPreparation(
					assetId,
					allowedMediaTypes,
				)
				if ("prepared" in preparation) {
					directResults.set(assetId, preparation.prepared)
					return
				}
				if ("pending" in preparation) {
					pendingResults.set(assetId, preparation.pending)
					return
				}
				downloadSourcesByIndex[index] = preparation.source
			}),
		)
		const downloadSources = downloadSourcesByIndex.filter(
			(source): source is AssetMediaDownloadSource => Boolean(source),
		)

		const groupedSources = new Map<CanvasAssetMediaType, AssetMediaDownloadSource[]>()
		for (const source of downloadSources) {
			const group = groupedSources.get(source.mediaType) ?? []
			group.push(source)
			groupedSources.set(source.mediaType, group)
		}
		const batchPendingResults = new Map<string, Promise<PreparedAssetMedia>>()
		for (const sources of groupedSources.values()) {
			const batchPromise = this.downloadAndUploadBatch(sources)
			sources.forEach((source, index) => {
				const pending = batchPromise.then((prepared) => {
					const result = prepared[index]
					if (!result) throw new Error("Asset upload result is missing")
					return result
				})
				batchPendingResults.set(source.assetId, pending)
				this.importPromises.set(source.assetId, pending)
			})
		}

		try {
			await Promise.all([...batchPendingResults.values(), ...pendingResults.values()])
			for (const [assetId, pending] of batchPendingResults) {
				directResults.set(assetId, await pending)
			}
			for (const [assetId, pending] of pendingResults) {
				directResults.set(assetId, await pending)
			}
		} finally {
			for (const [assetId, pending] of batchPendingResults) {
				if (this.importPromises.get(assetId) === pending)
					this.importPromises.delete(assetId)
			}
		}

		return assetIds.map((assetId) => {
			const prepared = directResults.get(assetId)
			if (!prepared) throw new Error("Failed to prepare asset media")
			return prepared
		})
	}

	private async downloadAndUploadBatch(
		sources: readonly AssetMediaDownloadSource[],
	): Promise<PreparedAssetMedia[]> {
		const downloaded = await Promise.all(
			sources.map(async (source) => {
				const response = await fetch(source.fileUrl, { cache: "default" })
				if (!response.ok)
					throw new Error(`Failed to download asset media: ${response.status}`)
				const blob = await response.blob()
				if (blob.size === 0) throw new Error("Downloaded asset media is empty")

				const mimeType = blob.type || FALLBACK_MIME_TYPES[source.mediaType]
				const fileName = buildAssetFileName({ ...source, mimeType })
				const file = new File([blob], fileName, { type: mimeType })
				const dimensions = await resolveImportedMediaDimensions({
					assetId: source.assetId,
					mediaType: source.mediaType,
					file,
					fileUrl: source.fileUrl,
				})
				return { source, file, fileName, dimensions }
			}),
		)

		const uploadResults = await this.canvas.canvasFileUploadManager.uploadDirect(
			downloaded.map(({ file }) => file),
			undefined,
			undefined,
			{ uploadSubDir: getAssetUploadSubDir(sources[0]?.mediaType ?? "image") },
		)
		if (uploadResults.length !== downloaded.length) {
			throw new Error("Asset upload result count does not match input files")
		}

		return downloaded.map(({ source, fileName, dimensions }, index) => {
			const uploadResult = uploadResults[index]
			if (!uploadResult?.path) throw new Error("Asset upload returned no workspace path")
			this.primeMediaCache(source.mediaType, uploadResult)
			return {
				assetId: source.assetId,
				mediaType: source.mediaType,
				workspacePath: uploadResult.path,
				fileName: uploadResult.fileName || fileName,
				dimensions,
				source: "downloaded",
			}
		})
	}

	private async downloadAndUpload(
		options: AssetMediaDownloadSource,
	): Promise<PreparedAssetMedia> {
		const pending = this.downloadAndUploadBatch([options]).then(([prepared]) => {
			if (!prepared) throw new Error("Asset upload result is missing")
			return prepared
		})
		this.importPromises.set(options.assetId, pending)
		try {
			return await pending
		} finally {
			if (this.importPromises.get(options.assetId) === pending) {
				this.importPromises.delete(options.assetId)
			}
		}
	}

	private findBinding(
		assetId: string,
		allowedMediaTypes: readonly CanvasAssetMediaType[],
	): CanvasAssetMediaBinding | null {
		return findCanvasAssetMediaBinding(this.canvas, { assetId, allowedMediaTypes })
	}

	private fromBinding(binding: CanvasAssetMediaBinding): PreparedAssetMedia {
		return {
			...binding,
			dimensions: getRememberedAssetMediaDimensions(binding.assetId) ?? binding.dimensions,
			source: "existing-binding",
		}
	}

	private primeMediaCache(
		mediaType: CanvasAssetMediaType,
		uploadResult: UploadFileResponse,
	): void {
		if (mediaType === "image") {
			this.canvas.imageResourceManager.primeCache(uploadResult.path, uploadResult)
			return
		}
		if (mediaType === "video") {
			this.canvas.videoResourceManager.primeCache(uploadResult.path, uploadResult)
			return
		}
		this.canvas.audioResourceManager.primeCache(uploadResult.path, uploadResult)
	}

	private createMediaElement(
		prepared: PreparedAssetMedia,
		targetElementId: string,
	): string | null {
		const originRect = this.canvas.geometryCacheManager.getElementBounds(targetElementId)
		const target = this.canvas.elementManager.getElementData(targetElementId)
		if (!target) return null
		const fallbackRect = {
			x: target.x ?? 0,
			y: target.y ?? 0,
			width: target.width ?? 1,
			height: target.height ?? 1,
		}
		const resolvedOriginRect = originRect ?? fallbackRect
		const position = resolveConnectedPlacement(
			this.canvas,
			{
				originSide: "left",
				canvasX: resolvedOriginRect.x,
				canvasY: resolvedOriginRect.y + resolvedOriginRect.height / 2,
				source: "handle",
			},
			prepared.dimensions,
			{
				output: "top-left",
				originElementId: targetElementId,
				originRect: resolvedOriginRect,
			},
		)
		const elementId = generateElementId()
		const elementType = getElementType(prepared.mediaType)
		const baseElement = ElementFactory.createElementData(
			elementType,
			elementId,
			position.x,
			position.y,
			prepared.dimensions.width,
			prepared.dimensions.height,
			this.canvas.elementManager.getNextZIndexInLevel(),
		) as ImageElement | VideoElement | AudioElement
		const namedElement = {
			...baseElement,
			name: getElementName(prepared.fileName, prepared.mediaType),
		}
		const contentPatch = { src: prepared.workspacePath, assetId: prepared.assetId }
		let element: ImageElement | VideoElement | AudioElement
		switch (namedElement.type) {
			case ElementTypeEnum.Image:
				element = updateContent(
					namedElement,
					namedElement.activeContentId ?? undefined,
					contentPatch,
				)
				break
			case ElementTypeEnum.Video:
				element = updateContent(
					namedElement,
					namedElement.activeContentId ?? undefined,
					contentPatch,
				)
				break
			case ElementTypeEnum.Audio:
				element = updateContent(
					namedElement,
					namedElement.activeContentId ?? undefined,
					contentPatch,
				)
				break
		}
		const created = this.canvas.elementManager.create(element)
		return created?.elementId ?? null
	}

	private createStandaloneMediaElement(
		prepared: PreparedAssetMedia,
		position: { x: number; y: number },
	): string | null {
		const elementId = generateElementId()
		const elementType = getElementType(prepared.mediaType)
		const baseElement = ElementFactory.createElementData(
			elementType,
			elementId,
			position.x,
			position.y,
			prepared.dimensions.width,
			prepared.dimensions.height,
			this.canvas.elementManager.getNextZIndexInLevel(),
		) as ImageElement | VideoElement | AudioElement
		const namedElement = {
			...baseElement,
			name: getElementName(prepared.fileName, prepared.mediaType),
		}
		const contentPatch = { src: prepared.workspacePath, assetId: prepared.assetId }
		let element: ImageElement | VideoElement | AudioElement
		switch (namedElement.type) {
			case ElementTypeEnum.Image:
				element = updateContent(
					namedElement,
					namedElement.activeContentId ?? undefined,
					contentPatch,
				)
				break
			case ElementTypeEnum.Video:
				element = updateContent(
					namedElement,
					namedElement.activeContentId ?? undefined,
					contentPatch,
				)
				break
			case ElementTypeEnum.Audio:
				element = updateContent(
					namedElement,
					namedElement.activeContentId ?? undefined,
					contentPatch,
				)
				break
		}

		const created = this.canvas.elementManager.create(element)
		return created?.elementId ?? null
	}
}
