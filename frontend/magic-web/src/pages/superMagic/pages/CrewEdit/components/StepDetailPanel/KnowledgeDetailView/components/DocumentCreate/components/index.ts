/**
 * 共享组件统一导出
 */

export { DocumentCreateHeader } from "./DocumentCreateHeader"
export { StepIndicator } from "./StepIndicator"
export { StepNavigation } from "./StepNavigation"
export { FileUploadCard } from "./FileUploadCard"
export { FileList } from "./FileList"
export { DocumentCreateLayout } from "../layout"
export { ProcessingProgressSection } from "./shared/ProcessingProgressSection"
export { StrategyConfigSection } from "./shared/StrategyConfigSection"
export { StepRenderer } from "./StepRenderer"
export { ErrorView } from "./ErrorView"
export { StepLoadingSkeleton } from "./StepLoadingSkeleton"

export type { DocumentCreateHeaderProps } from "./DocumentCreateHeader"
export type { StepIndicatorProps, Step, StepStatus } from "./StepIndicator/types"
export type { StepNavigationProps } from "./StepNavigation/types"
export type { FileUploadCardProps } from "./FileUploadCard/types"
export type { FileListProps } from "./FileList"
export type { DocumentCreateLayoutProps } from "../layout"
export type {
	ProcessingProgressSectionProps,
	ProcessingFileItem,
} from "./shared/ProcessingProgressSection"
export type { StrategyConfigSectionProps } from "./shared/StrategyConfigSection"
