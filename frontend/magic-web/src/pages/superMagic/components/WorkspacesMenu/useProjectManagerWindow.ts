import type { DialogWindowSize } from "@/hooks/use-dialog-window"
import {
	useDialogWindowFrame,
	type DialogWindowFrame,
} from "@/pages/superMagic/hooks/useDialogWindowFrame"

// 推荐尺寸只用于首次打开和主动恢复；手动缩放仍由窗口的最小尺寸与视窗边界约束。
const RECOMMENDED_SIZE: DialogWindowSize = { width: 1120, height: 840 }
const VIEWPORT_RATIO: DialogWindowSize = { width: 0.9, height: 0.86 }
const MIN_SIZE: DialogWindowSize = { width: 720, height: 480 }

export type ProjectManagerWindow = DialogWindowFrame

export function useProjectManagerWindow(
	open: boolean,
	options?: {
		preferenceKey: string
		recommendedSize: DialogWindowSize
		minSize: DialogWindowSize
	},
): ProjectManagerWindow {
	return useDialogWindowFrame(open, {
		storageKeyPrefix: `super_magic/${options?.preferenceKey ?? "project_manager"}`,
		recommendedSize: options?.recommendedSize ?? RECOMMENDED_SIZE,
		viewportRatio: VIEWPORT_RATIO,
		minSize: options?.minSize ?? MIN_SIZE,
	})
}
