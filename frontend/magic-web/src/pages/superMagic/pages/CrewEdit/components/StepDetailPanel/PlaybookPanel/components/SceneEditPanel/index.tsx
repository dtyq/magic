import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChevronLeft, Loader2, X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/tiptap-utils"
import { useCrewEditStore } from "../../../../../context"
import { useSceneByPlaybookId } from "./hooks/useSceneByPlaybookId"
import { BasicInfoPanel } from "./panels/BasicInfoPanel"
import { PresetsPanel } from "./panels/PresetsPanel"
import { QuickStartPanel } from "./panels/QuickStartPanel"
import { InspirationPanel } from "./panels/InspirationPanel"
import { SceneEditStore, SceneEditStoreContext } from "./store"

type NavTab = "basicInfo" | "presets" | "quickStart" | "inspiration"

interface SceneEditPanelProps {
	playbookId: string
	onBack: () => void
	onClose: () => void
}

export function SceneEditPanel({ playbookId, onBack, onClose }: SceneEditPanelProps) {
	const { t } = useTranslation("crew/create")
	const {
		playbook: { updateScene },
	} = useCrewEditStore()
	const [activeTab, setActiveTab] = useState<NavTab>("basicInfo")
	const { scene, loading, error, refresh } = useSceneByPlaybookId(playbookId)

	// Re-create the store only when the scene identity changes

	const store = useMemo(
		() =>
			scene
				? new SceneEditStore(scene, async (s) => {
					try {
						await updateScene(s)
						toast.success(t("playbook.edit.saveSuccess"))
					} catch {
						toast.error(t("playbook.edit.saveFailed"))
					}
				})
				: null,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[scene?.id],
	)

	const navItems: { id: NavTab; label: string }[] = [
		{ id: "basicInfo", label: t("playbook.edit.nav.basicInfo") },
		{ id: "presets", label: t("playbook.edit.nav.presets") },
		{ id: "quickStart", label: t("playbook.edit.nav.quickStart") },
		{ id: "inspiration", label: t("playbook.edit.nav.inspiration") },
	]

	if (loading) {
		return (
			<div
				className="mr-2 flex h-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm text-muted-foreground"
				data-testid="scene-edit-loading"
			>
				<Loader2 className="h-5 w-5 animate-spin" />
				{t("playbook.loading")}
			</div>
		)
	}

	if (error) {
		return (
			<div
				className="mr-2 flex h-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm text-destructive"
				data-testid="scene-edit-error"
			>
				<span>{error}</span>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={onBack}>
						{t("playbook.edit.backToList")}
					</Button>
					<Button size="sm" onClick={() => refresh()}>
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
				{t("playbook.noData")}
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
							{t("playbook.edit.backToList")}
						</Button>
						<p className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
							{t("playbook.edit.createPlaybook")}
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
				<div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden">
					{/* Left sidebar nav */}
					<div className="flex w-[224px] shrink-0 flex-col gap-1">
						{navItems.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setActiveTab(item.id)}
								className={cn(
									"flex h-8 w-full items-center rounded-md px-2 text-left text-sm transition-colors",
									activeTab === item.id
										? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
										: "font-normal text-sidebar-foreground hover:bg-sidebar-accent/50",
								)}
								data-testid={`scene-edit-nav-${item.id}`}
							>
								{item.label}
							</button>
						))}
					</div>

					{/* Right content panel */}
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
