import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChevronLeft, Loader2, X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { useCrewEditStore } from "../../../../../context"
import { BasicInfoPanel } from "./panels/BasicInfoPanel"
import { PresetsPanel } from "./panels/PresetsPanel"
import { QuickStartPanel } from "./panels/QuickStartPanel"
import { InspirationPanel } from "./panels/InspirationPanel"
import { SceneEditStore, SceneEditStoreContext } from "./store"
import { useSceneByPlaybookId } from "./hooks/useSceneByPlaybookId"
import { resolveLocalText } from "./utils"

type NavTab = "basicInfo" | "presets" | "quickStart" | "inspiration"

interface SceneEditPanelProps {
	playbookId: string
	onBack: () => void
	onClose: () => void
}

export function SceneEditPanel({ playbookId, onBack, onClose }: SceneEditPanelProps) {
	const { t, i18n } = useTranslation("crew/create")
	const { playbook } = useCrewEditStore()
	const [activeTab, setActiveTab] = useState<NavTab>("basicInfo")
	const resolvedPlaybookId = playbook.playbookIdMap.get(playbookId) ?? null
	const localScene =
		playbook.scenes.find((item) => item.id === playbookId) ??
		playbook.scenes.find((item) => item.id === resolvedPlaybookId) ??
		null
	const {
		scene: remoteScene,
		loading: sceneLoading,
		error: sceneError,
		refresh: refreshScene,
	} = useSceneByPlaybookId(resolvedPlaybookId)
	const scene = remoteScene ?? localScene

	const store = useMemo(
		() =>
			scene
				? new SceneEditStore(scene, async (s) => {
						try {
							await playbook.updateScene(s)
							toast.success(t("playbook.edit.saveSuccess"))
						} catch {
							toast.error(t("playbook.edit.saveFailed"))
						}
					})
				: null,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[scene],
	)

	const navItems: { id: NavTab; label: string }[] = [
		{ id: "basicInfo", label: t("playbook.edit.nav.basicInfo") },
		{ id: "presets", label: t("playbook.edit.nav.presets") },
		{ id: "quickStart", label: t("playbook.edit.nav.quickStart") },
		{ id: "inspiration", label: t("playbook.edit.nav.inspiration") },
	]

	if (playbook.scenesError) {
		return (
			<div
				className="mr-2 flex h-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm text-destructive"
				data-testid="scene-edit-error"
			>
				<span>{playbook.scenesError}</span>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={onBack}>
						{t("playbook.edit.backToList")}
					</Button>
					<Button size="sm" onClick={() => void playbook.fetchScenes()}>
						{t("playbook.retry")}
					</Button>
				</div>
			</div>
		)
	}

	if (resolvedPlaybookId && sceneLoading && !scene) {
		return (
			<div
				className="mr-2 flex h-full flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm text-muted-foreground"
				data-testid="scene-edit-loading"
			>
				<Loader2 className="h-4 w-4 animate-spin" />
				{t("playbook.loading")}
			</div>
		)
	}

	if (resolvedPlaybookId && sceneError && !scene) {
		return (
			<div
				className="mr-2 flex h-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm text-destructive"
				data-testid="scene-edit-error"
			>
				<span>{sceneError}</span>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={onBack}>
						{t("playbook.edit.backToList")}
					</Button>
					<Button size="sm" onClick={() => void refreshScene()}>
						{t("playbook.retry")}
					</Button>
				</div>
			</div>
		)
	}

	if (!scene || !store) {
		return (
			<div
				className="mr-2 flex h-full flex-1 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground"
				data-testid="scene-edit-empty"
			>
				{t("playbook.selectPlaybook")}
			</div>
		)
	}

	return (
		<SceneEditStoreContext.Provider value={store}>
			<div
				className="mr-2 flex h-full flex-col gap-3.5 overflow-hidden rounded-lg border border-border bg-background p-3.5"
				data-testid="scene-edit-panel"
			>
				{/* Header */}
				<div className="flex shrink-0 flex-col gap-3">
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-9 shrink-0 gap-2 shadow-xs"
							onClick={onBack}
							data-testid="scene-edit-back-button"
						>
							<ChevronLeft className="h-4 w-4" />
							{t("playbook.title")}
						</Button>
						<p className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
							{resolveLocalText(scene.name, i18n.language) ||
								t("playbook.edit.createPlaybook")}
						</p>
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 shrink-0 rounded-md"
							onClick={onClose}
							data-testid="scene-edit-close-button"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<Separator />
				</div>

				{/* Main content */}
				<div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
					<div className="shrink-0">
						<SmoothTabs
							tabs={navItems.map((item) => ({ value: item.id, label: item.label }))}
							value={activeTab}
							onChange={setActiveTab}
							variant="background"
							className="h-9 w-full bg-muted p-[3px]"
							buttonClassName="h-[30px] rounded-md py-0 text-sm"
							indicatorClassName="inset-y-[3px] h-[30px]"
							showTooltip={false}
						/>
					</div>
					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						{activeTab === "basicInfo" && <BasicInfoPanel />}
						{activeTab === "presets" && <PresetsPanel />}
						{activeTab === "quickStart" && <QuickStartPanel />}
						{activeTab === "inspiration" && <InspirationPanel />}
					</div>
				</div>
			</div>
		</SceneEditStoreContext.Provider>
	)
}
