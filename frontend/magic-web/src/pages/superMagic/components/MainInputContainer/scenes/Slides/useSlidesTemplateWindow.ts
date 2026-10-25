import type { DialogWindowSize } from "@/hooks/use-dialog-window"
import {
	useDialogWindowFrame,
	type DialogWindowFrame,
} from "@/pages/superMagic/hooks/useDialogWindowFrame"

// 推荐尺寸用于首次打开和主动恢复；手动缩放受最小尺寸与视窗边界约束。
const RECOMMENDED_SIZE: DialogWindowSize = { width: 1200, height: 760 }
const VIEWPORT_RATIO: DialogWindowSize = { width: 0.9, height: 0.86 }
const MIN_SIZE: DialogWindowSize = { width: 720, height: 520 }

export type SlidesTemplateWindow = DialogWindowFrame

export function useSlidesTemplateWindow(open: boolean): SlidesTemplateWindow {
	return useDialogWindowFrame(open, {
		storageKeyPrefix: "super_magic/slides_template_dialog",
		recommendedSize: RECOMMENDED_SIZE,
		viewportRatio: VIEWPORT_RATIO,
		minSize: MIN_SIZE,
	})
}
