import type { ComponentType } from "react"
import type { Knowledge } from "@/types/knowledge"
import type { CrewKnowledge } from "@/types/crew-knowledge"

export interface CreateKnowledgeDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSuccess: (newKnowledgeCode?: string) => void
	editKnowledge?: Knowledge.KnowledgeItem | null
}

export interface KnowledgeTypeOption {
	value: CrewKnowledge.KnowledgeSourceType
	icon: ComponentType<{ className?: string }>
	labelKey: string
	disabled?: boolean
}

export interface KnowledgeSourceOption {
	value: CrewKnowledge.KnowledgeSourceType
	icon: ComponentType<{ className?: string }>
	labelKey: string
	descKey: string
	disabled?: boolean
}

export interface FieldErrors {
	name?: string
	type?: string
	source?: string
}

export type SubmitAction = "edit" | "createOnly" | "createAndImport"
