import { MentionItemType, type SkillMentionData } from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const skillsValidationPlugin: MentionPanelValidationPlugin = {
	itemType: MentionItemType.SKILL,
	validate: ({ store, data }) => store.skillsStore.hasItem((data as SkillMentionData).id),
}
