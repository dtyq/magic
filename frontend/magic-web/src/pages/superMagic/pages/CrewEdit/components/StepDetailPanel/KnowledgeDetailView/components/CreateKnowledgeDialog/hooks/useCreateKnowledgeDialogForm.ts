import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import { CrewKnowledge } from "@/types/crew-knowledge"
import magicToast from "@/components/base/MagicToaster/utils"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { useCrewEditStore } from "../../../../../../context"
import { DEFAULT_KNOWLEDGE_TYPE, DEFAULT_KNOWLEDGE_SOURCE } from "../constants"
import { getFieldErrorsForSubmit, isValidationPass } from "../validation"
import type { CreateKnowledgeDialogProps, FieldErrors, SubmitAction } from "../types"

type UseFormParams = Pick<
	CreateKnowledgeDialogProps,
	"open" | "onOpenChange" | "onSuccess" | "editKnowledge"
>

/**
 * 将知识库来源类型映射到文档创建类型
 */
function mapSourceTypeToDocumentType(
	sourceType: CrewKnowledge.KnowledgeSourceType,
): "local" | "custom" | "project" | "wiki" {
	switch (sourceType) {
		case CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT:
			return "local"
		case CrewKnowledge.KnowledgeSourceType.CUSTOM_CONTENT:
			return "custom"
		case CrewKnowledge.KnowledgeSourceType.PROJECT_FILE:
			return "project"
		case CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE:
			return "wiki"
		default:
			return "local"
	}
}

export function useCreateKnowledgeDialogForm({
	open,
	onOpenChange,
	onSuccess,
	editKnowledge = null,
}: UseFormParams) {
	const { t } = useTranslation("crew/create")
	const navigate = useNavigate()
	const store = useCrewEditStore()

	const [loading, setLoading] = useState(false)
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [selectedType, setSelectedType] = useState<CrewKnowledge.KnowledgeSourceType | null>(
		DEFAULT_KNOWLEDGE_TYPE,
	)
	const [selectedSource, setSelectedSource] = useState<CrewKnowledge.KnowledgeSourceType | null>(
		DEFAULT_KNOWLEDGE_SOURCE,
	)
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

	const isEditing = Boolean(editKnowledge)

	useEffect(() => {
		setFieldErrors({})
		if (editKnowledge) {
			setName(editKnowledge.name)
			setDescription(editKnowledge.description || "")
			setSelectedType(null)
			setSelectedSource(null)
			return
		}
		setName("")
		setDescription("")
		setSelectedType(DEFAULT_KNOWLEDGE_TYPE)
		setSelectedSource(DEFAULT_KNOWLEDGE_SOURCE)
	}, [editKnowledge, open])

	const clearNameError = useCallback(() => {
		setFieldErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev))
	}, [])

	const clearTypeError = useCallback(() => {
		setFieldErrors((prev) => (prev.type ? { ...prev, type: undefined } : prev))
	}, [])

	const clearSourceError = useCallback(() => {
		setFieldErrors((prev) => (prev.source ? { ...prev, source: undefined } : prev))
	}, [])

	const toggleType = useCallback(
		(value: CrewKnowledge.KnowledgeSourceType) => {
			// 类型选择应该是单选，不是 toggle，所以直接设置
			setSelectedType(value)
			clearTypeError()

			// 当选择类型时，自动设置对应的导入方式
			if (value === CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT) {
				// Documents 类型默认选择 Local Documents
				setSelectedSource(CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT)
			} else if (value === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE) {
				// Project 类型自动选择 Project
				setSelectedSource(CrewKnowledge.KnowledgeSourceType.PROJECT_FILE)
			} else if (value === CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE) {
				// Enterprise Wiki 类型自动选择 Enterprise Knowledge
				setSelectedSource(CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE)
			}
		},
		[clearTypeError],
	)

	const toggleSource = useCallback(
		(value: CrewKnowledge.KnowledgeSourceType) => {
			setSelectedSource((prev) => (prev === value ? null : value))
			clearSourceError()
		},
		[clearSourceError],
	)

	const validateForAction = useCallback(
		(action: SubmitAction) => {
			const next = getFieldErrorsForSubmit({
				action,
				nameTrimmed: name.trim(),
				selectedType,
				selectedSource,
				messages: {
					nameRequired: t("knowledgeBase.create.nameRequired"),
					typeRequired: t("knowledgeBase.create.typeRequired"),
					sourceRequired: t("knowledgeBase.create.sourceRequired"),
				},
			})
			setFieldErrors(next)
			return isValidationPass(next)
		},
		[name, selectedType, selectedSource, t],
	)

	const runSubmit = useCallback(
		async (action: SubmitAction) => {
			if (!validateForAction(action)) return

			setLoading(true)
			try {
				if (isEditing && editKnowledge) {
					await KnowledgeApi.updateKnowledge({
						code: editKnowledge.code,
						name: name.trim(),
						description: description.trim(),
						icon: "",
						enabled: editKnowledge.enabled,
						// 编辑时source_type可选,保持原来的类型
						source_type: editKnowledge.source_type,
					})
				} else {
					// 创建知识库时，使用 selectedType 作为 source_type
					const sourceType = selectedType ?? DEFAULT_KNOWLEDGE_TYPE
					const result = await KnowledgeApi.createKnowledge({
						name: name.trim(),
						description: description.trim(),
						icon: "",
						enabled: true,
						source_type: sourceType,
						agent_codes: store.crewCode ? [store.crewCode] : undefined,
					})

					magicToast.success(t("knowledgeBase.create.success"))

					// 根据不同的 action 执行不同的导航逻辑
					if (store.crewCode) {
						if (action === "createAndImport") {
							// 创建并导入：根据 selectedSource 跳转到对应的文档创建页面
							// 对于 Project 和 Enterprise Wiki，使用 selectedType（因为它们没有单独的 source 选择）
							const importType =
								sourceType === CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT
									? (selectedSource ?? sourceType)
									: sourceType
							const documentType = mapSourceTypeToDocumentType(importType)
							navigate({
								name: RouteName.CrewEdit,
								params: { id: store.crewCode },
								query: {
									panel: "knowledge",
									code: result.code,
									mode: "create",
									type: documentType,
								},
							})
						} else if (action === "createOnly") {
							// 仅创建：选中新知识库但保持浏览模式
							navigate({
								name: RouteName.CrewEdit,
								params: { id: store.crewCode },
								query: {
									panel: "knowledge",
									code: result.code,
								},
							})
						}
					}

					// 关闭对话框并传递新创建的知识库 code
					onOpenChange(false)
					onSuccess(result.code)
					return
				}

				onOpenChange(false)
				onSuccess()
			} catch {
				magicToast.error(
					isEditing ? t("knowledgeBase.updateFailed") : t("knowledgeBase.create.failed"),
				)
			} finally {
				setLoading(false)
			}
		},
		[
			validateForAction,
			isEditing,
			editKnowledge,
			name,
			description,
			selectedType,
			selectedSource,
			t,
			navigate,
			store.crewCode,
			onOpenChange,
			onSuccess,
		],
	)

	return {
		loading,
		name,
		setName,
		description,
		setDescription,
		selectedType,
		selectedSource,
		fieldErrors,
		isEditing,
		clearNameError,
		toggleType,
		toggleSource,
		runSubmit,
	}
}
