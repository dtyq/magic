import { CrewKnowledge } from "@/types/crew-knowledge"
import type { FieldErrors, SubmitAction } from "./types"

interface GetFieldErrorsParams {
	action: SubmitAction
	nameTrimmed: string
	selectedType: CrewKnowledge.KnowledgeSourceType | null
	selectedSource: CrewKnowledge.KnowledgeSourceType | null
	messages: {
		nameRequired: string
		typeRequired: string
		sourceRequired: string
	}
}

export function getFieldErrorsForSubmit(params: GetFieldErrorsParams): FieldErrors {
	const next: FieldErrors = {}
	if (!params.nameTrimmed) next.name = params.messages.nameRequired

	// 创建时必须选择类型
	if (params.action !== "edit" && params.selectedType === null) {
		next.type = params.messages.typeRequired
	}

	// 仅当 action 为 createAndImport 且类型为 Documents 时需要验证导入方式
	// 对于 Project 和 Enterprise Wiki 类型，导入方式会自动设置，不需要验证
	if (params.action === "createAndImport") {
		if (params.selectedType === CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT) {
			// Documents 类型需要用户选择导入方式
			if (params.selectedSource === null) {
				next.source = params.messages.sourceRequired
			}
		}
		// Project 和 Enterprise Wiki 类型的 source 会自动设置，不需要验证
	}

	return next
}

export function isValidationPass(errors: FieldErrors): boolean {
	return !(errors.name || errors.type || errors.source)
}
