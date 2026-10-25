/**
 * The staged view the "了解 AI 录音完成流程" tour walks over, together with the mock recording it
 * runs on. The recordings page mounts the demo; nothing else does, because the anchors it publishes
 * are only meaningful while that page is the one hosting the run.
 */
export { default as RecordingGuideDemo } from "./RecordingGuideDemo"
export {
	RECORDING_GUIDE_MOCK_RECORDING,
	RECORDING_GUIDE_STEP_COUNT,
	resolveRecordingGuideStage,
	type RecordingGuideMenu,
	type RecordingGuideStage,
	type RecordingGuideStageState,
} from "./recording-guide-mock"
