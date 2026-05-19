import { MentionItemType } from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const uploadFilesValidationPlugin: MentionPanelValidationPlugin = {
	itemType: MentionItemType.UPLOAD_FILE,
	validate: () => true,
}
