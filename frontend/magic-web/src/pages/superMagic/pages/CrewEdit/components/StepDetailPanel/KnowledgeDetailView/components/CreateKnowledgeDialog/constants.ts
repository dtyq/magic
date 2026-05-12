import { FileUp, TextCursorInput, FolderDot, BookMarked, FileText } from "lucide-react"
import { CrewKnowledge } from "@/types/crew-knowledge"
import type { KnowledgeSourceOption, KnowledgeTypeOption } from "./types"

export const KNOWLEDGE_CREATE_LABEL_COL_CLASS = "w-24 shrink-0 text-base font-medium"

/** 知识库类型选项 */
export const KNOWLEDGE_TYPE_OPTIONS: KnowledgeTypeOption[] = [
	{
		value: CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT,
		icon: FileText,
		labelKey: "typeDocuments",
	},
	{
		value: CrewKnowledge.KnowledgeSourceType.PROJECT_FILE,
		icon: FolderDot,
		labelKey: "typeProject",
	},
	{
		value: CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE,
		icon: BookMarked,
		labelKey: "typeEnterpriseWiki",
	},
]

/** 导入方式选项 - 用于 Documents 类型 */
export const IMPORT_SOURCE_OPTIONS: KnowledgeSourceOption[] = [
	{
		value: CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT,
		icon: FileUp,
		labelKey: "sourceTypeLocalFile",
		descKey: "sourceTypeLocalFileDesc",
	},
	{
		value: CrewKnowledge.KnowledgeSourceType.CUSTOM_CONTENT,
		icon: TextCursorInput,
		labelKey: "sourceTypeCustomContent",
		descKey: "sourceTypeCustomContentDesc",
	},
]

/** 全部导入方式选项 - 保留用于兼容性 */
export const KNOWLEDGE_SOURCE_OPTIONS: KnowledgeSourceOption[] = [
	...IMPORT_SOURCE_OPTIONS,
	{
		value: CrewKnowledge.KnowledgeSourceType.PROJECT_FILE,
		icon: FolderDot,
		labelKey: "sourceTypeProjectFile",
		descKey: "sourceTypeProjectFileDesc",
	},
	{
		value: CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE,
		icon: BookMarked,
		labelKey: "sourceTypeEnterpriseKnowledge",
		descKey: "sourceTypeEnterpriseKnowledgeDesc",
	},
]

export const DEFAULT_KNOWLEDGE_TYPE = CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT
export const DEFAULT_KNOWLEDGE_SOURCE = CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT
