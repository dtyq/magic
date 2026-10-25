import type { DialogWindowSize } from "@/hooks/use-dialog-window"
import {
	useDialogWindowFrame,
	type DialogWindowFrame,
} from "@/pages/superMagic/hooks/useDialogWindowFrame"

// 推荐尺寸用于首次打开和主动恢复；手动缩放受最小尺寸与视窗边界约束。
const RECOMMENDED_SIZE: DialogWindowSize = { width: 1080, height: 820 }
const VIEWPORT_RATIO: DialogWindowSize = { width: 0.9, height: 0.86 }
const MIN_SIZE: DialogWindowSize = { width: 720, height: 480 }

export type DesignStyleWindow = DialogWindowFrame

export function useDesignStyleWindow(open: boolean): DesignStyleWindow {
	return useDialogWindowFrame(open, {
		storageKeyPrefix: "super_magic/design_style_dialog",
		recommendedSize: RECOMMENDED_SIZE,
		viewportRatio: VIEWPORT_RATIO,
		minSize: MIN_SIZE,
	})
}
