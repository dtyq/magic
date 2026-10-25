export type {
	SlideConfig,
	ExportPhase,
	ExportPreflightResult,
	ExportProgress,
	ExportSummary,
	ByteCount,
	CapacityConfidence,
	LargeExportOptions,
	LargeExportOutputPolicy,
	MediaPolicy,
	NodeWritable,
	PptxDestination,
	PptxOutputSink,
	PreflightIssue,
	StagingPolicy,
	StreamingExportContent,
	StreamingExportHandle,
	LegacyExportHandle,
	LegacyExportOptions,
	LegacyExportSummary,
	StreamingOptionsBase,
	StreamingHtmlPage,
	StreamingHtmlPageInput,
	ZipMode,
} from "./options"
export type {
	ImagePolicy,
	ImagePreflightAction,
	ImagePreflightDecision,
	ImagePreflightPolicy,
	ImagePreflightReason,
	ImagePreflightRejectAction,
	ImageTransformDescriptor,
	ImageTransformDescriptorInput,
	ImageTransformDescriptorResult,
} from "../media/image-preflight"
export { imagePolicyRequiresReplay, preflightPptImage } from "../media/image-preflight"
export { preflightPptxExport, type PreflightOptions } from "./preflight"
export {
	createBufferedPptxSink,
	PPTX_MIME_TYPE,
	type BufferedPptxSink,
} from "../packaging/buffered-sink"
export { createPptxLegacyExporter, exportPPTXLegacy } from "../pipeline/legacy-export"
export {
	resolveStreamingMediaPolicyMode,
	type ResolveMediaPolicyModeOptions,
	type ResolvedMediaPolicyMode,
} from "./strategy"
export type {
	EmbedFontInput,
	FontMissPolicy,
	FontResolver,
	FontResolverContext,
	UsedFont,
} from "./font"
