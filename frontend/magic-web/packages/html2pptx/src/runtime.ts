import type { EmbedFontInput } from "./api/font"
import type { ResourceLoadError, SlideConfig } from "./api/options"
import type { ElementNode } from "./ir/dom"
import type { PPTNode } from "./ir/node"
import type { IconBackup } from "./materialize/pseudo-icon"
import type { MediaSourceDescriptor } from "./media/source-descriptor"
import type { ImageTransformDescriptor } from "./media/image-preflight"
import type { PrepareSlideNodesInput, PrepareSlideNodesResult } from "./pipeline/render-slide"
import type {
	SandboxInstance,
	SandboxReadyControllerConstructor,
} from "./sandbox/htmlRenderSandbox"
import type { TextMergeMode } from "./pipeline/text-merge-mode"
import type {
	CreateStreamingPresentationPackagerInput,
	StreamingPresentationPackager,
} from "./packaging/streaming-types"

export interface StreamingStagingStore {
	/** Optional implementation marker used for OPFS-specific descriptor handling. */
	readonly stagingKind?: "opfs" | "memory" | "custom"
	createSession(sessionId: string, options?: StreamingStagingOperationOptions): Promise<void>
	stage(
		source: MediaSourceDescriptor,
		options?: {
			signal?: AbortSignal
			directory?: "media" | "transformed" | "scratch"
			onProgress?: (loaded: number, total?: number) => void
		},
	): Promise<MediaSourceDescriptor>
	putSlideIr(
		slideIndex: number,
		value: unknown,
		options?: StreamingStagingOperationOptions,
	): Promise<void>
	getSlideIr<T>(slideIndex: number, options?: StreamingStagingOperationOptions): Promise<T>
	deleteSlideIr?(slideIndex: number, options?: StreamingStagingOperationOptions): Promise<void>
	cleanupSession(sessionId: string): Promise<void>
}

/** Cancellation context for operations that touch staged SlideIR records. */
export interface StreamingStagingOperationOptions {
	signal?: AbortSignal
}

export interface CreateStreamingStagingStoreInput {
	config: SlideConfig
	sessionId: string
}

export interface RenderSlideRuntime {
	transformElements?: (
		elements: ElementNode[],
		config: SlideConfig,
		iWindow: Window,
		options?: {
			textMergeMode?: TextMergeMode
			/**
			 * All collected DOM nodes, including nodes filtered from drawing. Text
			 * flow still needs these nodes for visibility and inherited styles.
			 */
			elementNodeMap?: Map<Element, ElementNode>
		},
	) => PPTNode[]
	materializePseudoIcons?: (document: Document, window: Window) => IconBackup[]
	restoreIcons?: (backups: IconBackup[]) => void
	resolveCaptures?: (
		nodes: PPTNode[],
		signal?: AbortSignal,
		onResourceError?: (error: ResourceLoadError) => void,
	) => Promise<void>
	materializeVideoCoverNodes?: (
		nodes: PPTNode[],
		signal?: AbortSignal,
		onResourceError?: (error: ResourceLoadError) => void,
	) => Promise<void>
	materializePptImageNodes?: (
		nodes: PPTNode[],
		signal?: AbortSignal,
		onResourceError?: (error: ResourceLoadError) => void,
	) => Promise<void>
}

export interface ExportPipelineRuntime extends RenderSlideRuntime {
	/** Optional descriptor-only image conversion hook used when imagePolicy requests transform. */
	transformImageDescriptor?: ImageTransformDescriptor
	prepareSlideNodes?: (input: PrepareSlideNodesInput) => Promise<PrepareSlideNodesResult>
	/**
	 * Optional Phase 4 Packaging Worker hook. The host creates this only after a
	 * complete PptxGenJS SlidePlan/CapacityPlan is available.
	 */
	createStreamingPresentationPackager?: (
		input: CreateStreamingPresentationPackagerInput,
	) => StreamingPresentationPackager
	/** Optional OPFS/native staging implementation used by two-pass large exports. */
	createStreamingStagingStore?: (
		input: CreateStreamingStagingStoreInput,
	) => StreamingStagingStore | Promise<StreamingStagingStore>
}

export interface Html2PptxRuntime {
	createSandbox?: (config: SlideConfig) => SandboxInstance
	sandboxReadyController?: SandboxReadyControllerConstructor
	pipeline?: ExportPipelineRuntime
}

export type { EmbedFontInput }
