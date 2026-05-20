import { useCallback, useEffect, useMemo, useRef } from "react"
import type { JSONContent } from "@tiptap/core"
import { FieldConfigPanel, GuidePanel } from "../panels"
import {
	SkillPanelType,
	OptionItem,
	FieldItem,
	GuideItem,
	SkillPanelConfigArray,
} from "../panels/types"
import { useLocaleText } from "../panels/hooks/useLocaleText"
import DemoPanel from "../panels/DemoPanel"
import SkillPanelSkeleton from "./skeleton/SkillPanelSkeleton"
import { observer } from "mobx-react-lite"
import { ScenePanelVariant } from "./LazyScenePanel/types"
import { useOptionalScenePanelVariant, useOptionalSceneStateStore } from "../stores"

interface ScenePanelContainerProps {
	panels?: SkillPanelConfigArray
	loading?: boolean
	readOnly?: boolean
	compact?: boolean
	onTemplateSelect?: (template: OptionItem | null) => void
	onFilterChange?: (filters: FieldItem[]) => void
	onGuideItemClick?: (item: GuideItem) => void
}

function ScenePanelContainer({
	panels,
	loading = false,
	readOnly = false,
	compact = false,
	onTemplateSelect,
	onFilterChange,
	onGuideItemClick,
}: ScenePanelContainerProps) {
	const variant = useOptionalScenePanelVariant()
	const sceneStateStore = useOptionalSceneStateStore()
	const lt = useLocaleText()
	const presetContentMapRef = useRef<Record<string, JSONContent | undefined>>({})

	const fieldPanelKeys = useMemo(
		() =>
			(panels ?? []).flatMap((config, index) =>
				config.type === SkillPanelType.FIELD ? [buildPanelKey(config, index, lt)] : [],
			),
		[panels, lt],
	)

	// Flush FIELD panel merges when scope changes without new keys
	useEffect(() => {
		if (!sceneStateStore) return
		if (readOnly) return

		presetContentMapRef.current = {}
	}, [readOnly, sceneStateStore?.inputScopeKey, sceneStateStore])

	useEffect(() => {
		if (!sceneStateStore) return
		if (readOnly) return
		if (loading) return

		if (fieldPanelKeys.length === 0) {
			presetContentMapRef.current = {}
			sceneStateStore.setPresetSuffixContent(undefined)
			return
		}

		const nextEntries = Object.entries(presetContentMapRef.current).filter(([key]) =>
			fieldPanelKeys.includes(key),
		)
		presetContentMapRef.current = Object.fromEntries(nextEntries)
		sceneStateStore.setPresetSuffixContent(joinPresetContents(presetContentMapRef.current))
	}, [fieldPanelKeys, loading, readOnly, sceneStateStore])

	const createPresetContentChangeHandler = useCallback(
		(panelKey: string) => (content: JSONContent | undefined) => {
			if (!sceneStateStore) return
			if (readOnly) return

			presetContentMapRef.current[panelKey] = content
			sceneStateStore.setPresetSuffixContent(joinPresetContents(presetContentMapRef.current))
		},
		[readOnly, sceneStateStore],
	)

	const emptyContent = useMemo(() => {
		if (variant && [ScenePanelVariant.Mobile, ScenePanelVariant.TopicPage].includes(variant)) {
			return null
		}
		return <div className="flex min-h-8 flex-col gap-4" />
	}, [variant])

	// 第一次加载时显示骨架屏
	if (loading) {
		return <SkillPanelSkeleton variant={variant} />
	}

	if (!panels || panels.length === 0) return emptyContent

	if (variant && [ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant)) {
		const fieldPanels = panels.flatMap((config, index) =>
			config.type === SkillPanelType.FIELD
				? [{ config, panelKey: buildPanelKey(config, index, lt) }]
				: [],
		)

		if (fieldPanels?.length === 0) return emptyContent

		// 只渲染 FIELD 类型
		return (
			<div
				className={
					compact
						? "flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
						: "flex flex-col gap-4"
				}
			>
				{fieldPanels?.map(({ config, panelKey }) => {
					return (
						<FieldConfigPanel
							key={panelKey}
							config={config}
							onTemplateSelect={onTemplateSelect}
							onFilterChange={onFilterChange}
							onPresetContentChange={createPresetContentChangeHandler(panelKey)}
							readOnly={readOnly}
							variant={variant}
							compact={compact}
						/>
					)
				})}
			</div>
		)
	}

	return (
		<div className="flex min-h-8 flex-col gap-4">
			{panels?.map((config, index) => {
				// Generate stable key using type, title and index
				const key = `${config.type}-${lt(config.title) ?? ""}-${index}`

				switch (config.type) {
					case SkillPanelType.FIELD:
						return (
							<FieldConfigPanel
								key={key}
								config={config}
								onTemplateSelect={onTemplateSelect}
								onFilterChange={onFilterChange}
								onPresetContentChange={createPresetContentChangeHandler(key)}
								readOnly={readOnly}
								variant={variant}
								compact={compact}
							/>
						)
					case SkillPanelType.DEMO:
						return (
							<DemoPanel
								key={key}
								config={config}
								onTemplateSelect={onTemplateSelect}
								readOnly={readOnly}
							/>
						)
					case SkillPanelType.GUIDE:
						return (
							<GuidePanel
								key={key}
								config={config}
								onItemClick={onGuideItemClick}
								readOnly={readOnly}
							/>
						)
				}
			})}
		</div>
	)
}

function buildPanelKey(
	config: SkillPanelConfigArray[number],
	index: number,
	lt: ReturnType<typeof useLocaleText>,
) {
	return `${config.type}-${lt(config.title) ?? ""}-${index}`
}

function joinPresetContents(contentMap: Record<string, JSONContent | undefined>) {
	const docs = Object.values(contentMap).filter((content): content is JSONContent =>
		Boolean(content?.content?.length),
	)
	if (docs.length === 0) return undefined

	const content = docs.flatMap((doc, index) => {
		const shouldAddGap = index < docs.length - 1
		return shouldAddGap ? [...(doc.content ?? []), { type: "paragraph" }] : (doc.content ?? [])
	})

	return { type: "doc", content }
}

export default observer(ScenePanelContainer)
