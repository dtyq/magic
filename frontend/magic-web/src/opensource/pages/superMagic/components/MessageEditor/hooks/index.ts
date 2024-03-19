// Editor hooks
export { useMessageEditor } from "./useMessageEditor"

// Mention management hooks
export { useMentionManager } from "./useMentionManager"

// File upload hooks
export { useFileUpload } from "./useFileUpload"

// Drag upload hooks
export { useDragUpload } from "./useDragUpload"

// Slide content sync hooks
export { useSlideContentSync } from "./useSlideContentSync"

// Marker management hooks
export { useMessageEditorMarker } from "./useMessageEditorMarker"

// Container orchestration hooks
export { default as useResolvedEditorStore } from "./useResolvedEditorStore"
export { default as useSyncEditorStoreState } from "./useSyncEditorStoreState"
export { default as useEditorSlotContent } from "./useEditorSlotContent"
export { default as useUploadMentionFlow } from "./useUploadMentionFlow"
export { default as useMessageSendHandler } from "./useMessageSendHandler"
export { default as useMessageEditorImperativeRef } from "./useMessageEditorImperativeRef"

export { useMarkerClickHandler, type MarkerClickScene } from "./useMarkerClickHandler"
