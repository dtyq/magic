import type { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"

interface ShouldShowStartRecordingReminderParams {
	size: MessageEditorSize
	mode: "new" | "current"
}

export function shouldShowStartRecordingReminder({
	size,
	mode,
}: ShouldShowStartRecordingReminderParams) {
	return size === "mobile" && mode === "new"
}
