import { useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import ScenePanelContainer from "@/pages/superMagic/components/MainInputContainer/components/ScenePanelContainer"
import { ScenePanelVariant } from "@/pages/superMagic/components/MainInputContainer/components/LazyScenePanel/types"
import {
	SceneConfigStore,
	SceneStateProvider,
	SceneStateStore,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import type { SkillPanelConfig } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { useSceneEditStore } from "../store"

type PreviewTab = "home" | "topic"

const PREVIEW_VARIANT_MAP: Record<PreviewTab, ScenePanelVariant> = {
	home: ScenePanelVariant.HomePage,
	topic: ScenePanelVariant.TopicPage,
}

export const ScenePreviewPanel = observer(function ScenePreviewPanel() {
	const { t } = useTranslation("crew/create")
	const store = useSceneEditStore()
	const [activePreview, setActivePreview] = useState<PreviewTab>("home")
	const [previewStore] = useState(() => new SceneStateStore(new SceneConfigStore()))

	const panels = [store.presets, store.quickStart, store.inspiration].filter(
		Boolean,
	) as SkillPanelConfig[]

	const previewTabs: Array<{ value: PreviewTab; label: string; "data-testid": string }> = [
		{
			value: "home",
			label: t("playbook.edit.preview.home"),
			"data-testid": "scene-preview-home-tab",
		},
		{
			value: "topic",
			label: t("playbook.edit.preview.topic"),
			"data-testid": "scene-preview-topic-tab",
		},
	]

	return (
		<div
			className="flex shrink-0 flex-col gap-2.5 rounded-lg bg-muted/15 px-1"
			data-testid="scene-preview-panel"
		>
			<div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
				<div className="flex min-w-0 items-center gap-2">
					<p className="truncate text-xs font-medium text-muted-foreground">
						{t("playbook.edit.preview.title")}
					</p>
				</div>
				<div className="w-[220px]" data-testid="scene-preview-tabs">
					<SmoothTabs
						tabs={previewTabs}
						value={activePreview}
						onChange={setActivePreview}
						variant="background"
						className="h-8 w-full bg-muted p-[3px]"
						buttonClassName="h-[26px] rounded-md px-2 py-0 text-xs"
						indicatorClassName="inset-y-[3px] h-[26px]"
						showTooltip={false}
					/>
				</div>
			</div>
			<div
				className="min-h-[132px] overflow-hidden rounded-md bg-background/75 p-3"
				data-testid="scene-preview-content"
			>
				<SceneStateProvider
					store={previewStore}
					variant={PREVIEW_VARIANT_MAP[activePreview]}
				>
					{panels.length > 0 ? (
						<div className="max-h-[180px] overflow-y-auto pr-1">
							<ScenePanelContainer panels={panels} readOnly />
						</div>
					) : (
						<div
							className="flex min-h-[108px] items-center justify-center text-sm text-muted-foreground"
							data-testid="scene-preview-empty"
						>
							{t("playbook.edit.preview.empty")}
						</div>
					)}
				</SceneStateProvider>
			</div>
		</div>
	)
})
