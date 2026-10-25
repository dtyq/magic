import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type PointerEvent,
} from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import CollapsiblePanel from "../../panels/CollapsiblePanel"
import FilterBar from "../../panels/FilterBar"
import { useLocaleText } from "../../panels/hooks/useLocaleText"
import {
	type FieldItem,
	type FieldPanelConfig,
	type OptionItem,
	type LocaleText,
} from "../../panels/types"
import {
	buildConcatenatedPresetContent,
	findComplexField,
	isComplexField,
	localeTextToDisplayString,
} from "../../panels/utils"
import { ScenePanelVariant } from "../../components/LazyScenePanel/types"
import { useOptionalSceneStateStore } from "../../stores"
import {
	ALL_SLIDES_TEMPLATE_GROUP_KEY,
	SLIDES_TEMPLATE_DEFAULT_LANGUAGE,
	SLIDES_TEMPLATE_DEFAULT_SIZE,
} from "./slidesTemplateState"
import SlidesTemplateFloatingSelector from "./SlidesTemplateFloatingSelector"
import SlidesTemplatePanelContent from "./SlidesTemplatePanelContent"
import { useSlidesTemplatePanelState } from "./useSlidesTemplatePanelState"

interface SlidesTemplatePanelProps {
	config: FieldPanelConfig
	selectedTemplate?: OptionItem | null
	hideTemplateSelector?: boolean
	onFilterChangeRequestChange?: (
		handler: ((filterId: string, value: string) => void) | null,
	) => void
	onRandomTemplateRequestChange?: (handler: (() => void) | null) => void
	templatePickerContainer?: HTMLDivElement | null
	onTemplateSelect?: (template: OptionItem | null) => void
	onFilterChange?: (filters: FieldItem[]) => void
	onPresetContentChange?: (content: JSONContent | undefined) => void
	readOnly?: boolean
	variant?: ScenePanelVariant
	compact?: boolean
	onPreviewOpenChange?: (open: boolean) => void
}

function getInitialFilterValue(item: FieldItem): string {
	return localeTextToDisplayString(item.default_value)
}

function createRuntimeFieldItems(config: FieldPanelConfig): FieldItem[] {
	return (config.field?.items ?? []).map((item) => ({
		...item,
		current_value: getInitialFilterValue(item),
	}))
}

function updateFieldValue(
	fieldItems: FieldItem[],
	predicate: (item: FieldItem) => boolean,
	value: string | LocaleText,
) {
	return fieldItems.map((item) =>
		predicate(item)
			? {
					...item,
					current_value: localeTextToDisplayString(value),
				}
			: item,
	)
}

function updateTemplateRelatedFields(fieldItems: FieldItem[], hasTemplate: boolean): FieldItem[] {
	return fieldItems.map((item) => {
		if (!hasTemplate && item.data_key === "pages") {
			return {
				...item,
				current_value: "",
			}
		}

		if (item.data_key === "size") {
			return {
				...item,
				current_value: hasTemplate ? SLIDES_TEMPLATE_DEFAULT_SIZE : "",
			}
		}

		if (item.data_key === "language") {
			return {
				...item,
				current_value: hasTemplate ? SLIDES_TEMPLATE_DEFAULT_LANGUAGE : "",
			}
		}

		return item
	})
}

function SlidesTemplatePanel({
	config,
	selectedTemplate: controlledSelectedTemplate,
	hideTemplateSelector = false,
	onFilterChangeRequestChange,
	onRandomTemplateRequestChange,
	templatePickerContainer,
	onTemplateSelect,
	onFilterChange,
	onPresetContentChange,
	readOnly = false,
	variant,
	compact = false,
	onPreviewOpenChange,
}: SlidesTemplatePanelProps) {
	const lt = useLocaleText()
	const { t } = useTranslation("crew/create")
	const sceneStateStore = useOptionalSceneStateStore()
	const inputScopeKey = sceneStateStore?.inputScopeKey ?? ""
	const sendCount = sceneStateStore?.sendCount
	const lastHandledSendCountRef = useRef(sendCount)
	const lastHandledInputScopeKeyRef = useRef(inputScopeKey)
	const onTemplateSelectRef = useRef(onTemplateSelect)
	onTemplateSelectRef.current = onTemplateSelect
	const slidesState = useSlidesTemplatePanelState()
	const { setKeyword, setSelectedGroupKey } = slidesState
	const [fieldItems, setFieldItems] = useState(() => createRuntimeFieldItems(config))
	const [internalSelectedTemplate, setInternalSelectedTemplate] = useState<OptionItem | null>(
		null,
	)
	const templateDetailRequestSeqRef = useRef(0)
	const isSelectionControlled = controlledSelectedTemplate !== undefined
	const selectedTemplate = isSelectionControlled
		? controlledSelectedTemplate
		: internalSelectedTemplate

	useEffect(() => {
		setFieldItems(createRuntimeFieldItems(config))
		setInternalSelectedTemplate(null)
		setKeyword("")
		setSelectedGroupKey(ALL_SLIDES_TEMPLATE_GROUP_KEY)

		if (lastHandledInputScopeKeyRef.current === inputScopeKey) return
		lastHandledInputScopeKeyRef.current = inputScopeKey
		// Controlled parents must drop the previous topic's template.
		onTemplateSelectRef.current?.(null)
	}, [config, inputScopeKey, setKeyword, setSelectedGroupKey])

	useEffect(() => {
		// sendCount 在发送后会保持递增后的值。父组件因选择模板而重渲染时，
		// onTemplateSelect 的引用可能变化；这里必须只响应新的发送次数。
		if (
			sendCount === undefined ||
			sendCount <= (lastHandledSendCountRef.current ?? sendCount)
		) {
			lastHandledSendCountRef.current = sendCount
			return
		}

		lastHandledSendCountRef.current = sendCount
		const nextFieldItems = createRuntimeFieldItems(config)
		setFieldItems(nextFieldItems)
		setInternalSelectedTemplate(null)
		onTemplateSelect?.(null)
		setKeyword("")
		setSelectedGroupKey(ALL_SLIDES_TEMPLATE_GROUP_KEY)
	}, [config, onTemplateSelect, sendCount, setKeyword, setSelectedGroupKey])

	useEffect(() => {
		if (!isSelectionControlled) return

		const selectedValue = controlledSelectedTemplate
			? localeTextToDisplayString(controlledSelectedTemplate.value)
			: ""
		setFieldItems((currentFieldItems) => {
			const currentValue = localeTextToDisplayString(
				findComplexField(currentFieldItems)?.current_value,
			)
			if (currentValue === selectedValue && controlledSelectedTemplate) {
				return currentFieldItems
			}
			const nextFieldItems =
				currentValue === selectedValue
					? currentFieldItems
					: updateFieldValue(currentFieldItems, isComplexField, selectedValue)
			return updateTemplateRelatedFields(nextFieldItems, Boolean(controlledSelectedTemplate))
		})
	}, [controlledSelectedTemplate, isSelectionControlled])

	const simpleFields = useMemo(
		() => fieldItems.filter((item) => !isComplexField(item)),
		[fieldItems],
	)
	const presetFieldItems = useMemo(
		() =>
			selectedTemplate
				? fieldItems.map((item) =>
						isComplexField(item) ? { ...item, options: [selectedTemplate] } : item,
					)
				: fieldItems,
		[fieldItems, selectedTemplate],
	)
	const concatenatedContent = useMemo(
		() => buildConcatenatedPresetContent(presetFieldItems),
		[presetFieldItems],
	)

	useEffect(() => {
		if (readOnly) return
		onPresetContentChange?.(concatenatedContent)
	}, [concatenatedContent, onPresetContentChange, readOnly])

	useEffect(() => {
		onFilterChange?.(fieldItems)
	}, [fieldItems, onFilterChange])

	const applyFieldItems = useCallback((nextFieldItems: FieldItem[]) => {
		setFieldItems(nextFieldItems)
	}, [])

	const handleFilterChange = useCallback(
		(filterId: string, value: string) => {
			if (readOnly) return
			applyFieldItems(
				updateFieldValue(fieldItems, (item) => item.data_key === filterId, value),
			)
		},
		[applyFieldItems, fieldItems, readOnly],
	)

	useEffect(() => {
		onFilterChangeRequestChange?.(handleFilterChange)
		return () => onFilterChangeRequestChange?.(null)
	}, [handleFilterChange, onFilterChangeRequestChange])

	const handleTemplateClick = useMemoizedFn((template: OptionItem) => {
		if (readOnly) return
		const requestSeq = templateDetailRequestSeqRef.current + 1
		templateDetailRequestSeqRef.current = requestSeq
		const nextFieldItems = updateTemplateRelatedFields(
			updateFieldValue(fieldItems, isComplexField, template.value),
			true,
		)
		if (!isSelectionControlled) setInternalSelectedTemplate(template)
		applyFieldItems(nextFieldItems)
		onTemplateSelect?.(template)

		const code = typeof template.value === "string" ? template.value : ""
		if (!code) return

		// 选中后再补充详情资源，模板选择首屏始终只传输缩略图。
		void Promise.resolve(slidesState.loadTemplateDetail(code))
			.then((detail) => {
				if (!detail || requestSeq !== templateDetailRequestSeqRef.current) return
				if (!isSelectionControlled) setInternalSelectedTemplate(detail)
				onTemplateSelect?.(detail)
			})
			.catch((error) => {
				console.error("Failed to fetch slides template detail", error)
			})
	})

	const handleTemplateClear = useCallback(() => {
		if (readOnly) return

		templateDetailRequestSeqRef.current += 1
		const nextFieldItems = updateTemplateRelatedFields(
			updateFieldValue(fieldItems, isComplexField, ""),
			false,
		)
		if (!isSelectionControlled) setInternalSelectedTemplate(null)
		applyFieldItems(nextFieldItems)
		onTemplateSelect?.(null)
	}, [applyFieldItems, fieldItems, isSelectionControlled, onTemplateSelect, readOnly])

	const handleRandomTemplateRequest = useMemoizedFn(() => {
		if (readOnly || slidesState.templateOptions.length === 0) return

		const selectedValue = selectedTemplate
			? localeTextToDisplayString(selectedTemplate.value)
			: ""
		const unselectedTemplates = slidesState.templateOptions.filter(
			(template) => localeTextToDisplayString(template.value) !== selectedValue,
		)
		const candidates =
			unselectedTemplates.length > 0 ? unselectedTemplates : slidesState.templateOptions
		const template = candidates[Math.floor(Math.random() * candidates.length)]
		if (template) handleTemplateClick(template)
	})

	useEffect(() => {
		onRandomTemplateRequestChange?.(handleRandomTemplateRequest)
		return () => onRandomTemplateRequestChange?.(null)
	}, [handleRandomTemplateRequest, onRandomTemplateRequestChange])

	const handleHeaderFilterInteraction = (
		event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>,
	) => {
		event.stopPropagation()
	}

	const title = lt(config.title) || t("playbook.edit.presets.title")
	const templateCountLabel = t("playbook.edit.presets.templateCount", {
		count: slidesState.total.toLocaleString(),
	})
	const complexField = findComplexField(fieldItems)

	if (!complexField) return null
	if (slidesState.hasCheckedAnyTemplate && !slidesState.hasAnyTemplate) return null

	if (variant && [ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant)) {
		return (
			<SlidesTemplateFloatingSelector
				title={title}
				selectedTemplate={selectedTemplate}
				hideTrigger={hideTemplateSelector}
				templateCountLabel={templateCountLabel}
				simpleFields={simpleFields}
				slidesState={slidesState}
				onFilterChange={handleFilterChange}
				onTemplateClick={handleTemplateClick}
				templatePickerContainer={templatePickerContainer}
				readOnly={readOnly}
				variant={variant}
				compact={compact}
				onPreviewOpenChange={onPreviewOpenChange}
			/>
		)
	}

	if (variant === ScenePanelVariant.HomePage) {
		return (
			<SlidesTemplatePanelContent
				slidesState={slidesState}
				selectedTemplate={selectedTemplate}
				onTemplateClick={handleTemplateClick}
				onTemplateClear={handleTemplateClear}
				toolbarClassName="sticky top-0 z-50 bg-background/95 pb-3 backdrop-blur"
				// 首页由外层 ScrollArea 负责滚动，避免网格的 overscroll 限制阻断滚轮事件。
				gridClassName="overflow-y-visible overscroll-y-auto"
				showMyTemplates
				enableMyTemplateRemoval
				onPreviewOpenChange={onPreviewOpenChange}
			/>
		)
	}

	return (
		<CollapsiblePanel
			expandable={config.expandable}
			defaultExpanded={config.default_expanded}
			header={
				<div className="flex flex-1 items-center justify-between">
					<div className="flex shrink-0 items-center gap-2">
						<span className="font-medium">{title}</span>
						<span
							className="inline-flex flex-shrink-0 items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground shadow-sm"
							data-testid="slides-template-panel-template-count"
						>
							{templateCountLabel}
						</span>
					</div>
					<div
						className="min-w-0 flex-1"
						onPointerDown={handleHeaderFilterInteraction}
						onClick={handleHeaderFilterInteraction}
					>
						<FilterBar
							filters={simpleFields}
							onFilterChange={handleFilterChange}
							variant={variant}
							scrollContainerClassName="justify-end"
							compact={compact}
						/>
					</div>
				</div>
			}
		>
			<SlidesTemplatePanelContent
				slidesState={slidesState}
				selectedTemplate={selectedTemplate}
				onTemplateClick={handleTemplateClick}
				onPreviewOpenChange={onPreviewOpenChange}
			/>
		</CollapsiblePanel>
	)
}

export default observer(SlidesTemplatePanel)
