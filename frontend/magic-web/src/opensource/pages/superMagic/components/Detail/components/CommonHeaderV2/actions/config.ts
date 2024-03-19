import { DetailType } from "../../../types"
import type { ActionKey } from "../types"

const DEFAULT_ACTIONS: ActionKey[] = ["fullscreen", "more"]

export const DEFAULT_ACTION_KEYS_BY_TYPE: Record<string, ActionKey[]> = {
	[DetailType.Code]: ["refresh", "download", "copy", "share", "fullscreen", "more"],
	[DetailType.Text]: ["refresh", "download", "copy", "share", "fullscreen", "more"],
	[DetailType.Html]: ["viewMode", "refresh", "download", "copy", "share", "fullscreen", "more"],
	[DetailType.Md]: ["viewMode", "refresh", "download", "copy", "share", "fullscreen", "more"],
	[DetailType.Pdf]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.Docx]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.Excel]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.PowerPoint]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.Image]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.Video]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.Audio]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.Design]: ["refresh", "download", "share", "fullscreen", "more"],
	[DetailType.NotSupport]: ["download", "share", "fullscreen", "more"],
	[DetailType.Browser]: ["openUrl", "fullscreen", "more"],
	[DetailType.Terminal]: DEFAULT_ACTIONS,
	[DetailType.Search]: DEFAULT_ACTIONS,
	[DetailType.FileTree]: DEFAULT_ACTIONS,
	default: DEFAULT_ACTIONS,
}
