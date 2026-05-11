import type { MentionSkillItem } from "@/apis/modules/crew"

export type SkillDomainItem = MentionSkillItem

export interface SkillQueryContextOptions {
	topicMode?: string
	agentCode?: string
}
