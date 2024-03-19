import { useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { CirclePlus, Loader2, Search, Trash2, X } from "lucide-react"
import {
	DndContext,
	closestCenter,
	PointerSensor,
	KeyboardSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core"
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { useConfirmDialog } from "@/opensource/components/shadcn-composed/confirm-dialog"
import { useCrewEditStore } from "../../../context"
import { usePlaybookScenes } from "./hooks/usePlaybookScenes"
import { SceneRow } from "./components/SceneRow"
import { SceneEditPanel } from "./components/SceneEditPanel"
import type { SceneAction } from "./types"

export const PlaybookPanel = observer(function PlaybookPanel() {
	const store = useCrewEditStore()
	const { playbook, layout } = store
	const { t } = useTranslation("crew/create")

	// Track which scene is being edited (null = list view)
	const [editingSceneId, setEditingSceneId] = useState<string | null>(null)

	const {
		isLoading,
		error,
		selectedIds,
		searchValue,
		filterValue,
		allSelected,
		someSelected,
		filteredScenes,
		setSearchValue,
		setFilterValue,
		handleSelectAll,
		handleSelectOne,
		handleToggleEnabled,
		handleAction: _handleAction,
		handleReset,
		handleReorder,
		handleCancelSelection,
		handleBatchDelete,
	} = usePlaybookScenes()

	const { confirm, dialog: confirmDialog } = useConfirmDialog()

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (over && active.id !== over.id) {
			handleReorder(String(active.id), String(over.id))
		}
	}

	function handleAction(id: string, action: SceneAction) {
		if (action === "edit") {
			setEditingSceneId(id)
			return
		}
		_handleAction(id, action)
	}

	function handleCreateScene() {
		const scene = playbook.createScene()
		setEditingSceneId(scene.id)
	}

	function handleBatchDeleteClick() {
		const ids = Array.from(selectedIds)
		confirm({
			title: t("playbook.batchDeleteConfirm.title"),
			description: t("playbook.batchDeleteConfirm.description", { count: ids.length }),
			variant: "destructive",
			onConfirm: () => handleBatchDelete(ids),
		})
	}

	// If a scene is being edited, show the edit panel (fetch via API, not list data)
	if (editingSceneId !== null) {
		const playbookId = playbook.playbookIdMap.get(editingSceneId)
		if (playbookId !== undefined) {
			return (
				<SceneEditPanel
					playbookId={String(playbookId)}
					onBack={() => setEditingSceneId(null)}
					onClose={() => layout.closePlaybook()}
				/>
			)
		}
		// Scene is being created (persistCreateScene in progress), show loading
		return (
			<div
				className="mr-2 flex h-full flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm text-muted-foreground"
				data-testid="playbook-scene-creating"
			>
				<Loader2 className="h-5 w-5 animate-spin" />
				{t("playbook.creating")}
			</div>
		)
	}

	return (
		<div
			className="mr-2 flex h-full flex-col gap-3.5 overflow-hidden rounded-lg border border-border bg-background p-3.5"
			data-testid="playbook-panel"
		>
			{confirmDialog}
			{/* Header */}
			<div className="flex shrink-0 flex-col gap-3">
				<div className="flex items-center gap-2">
					<p className="min-w-0 flex-1 truncate text-2xl font-medium text-foreground">
						{t("playbook.title")}
					</p>
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0 rounded-md"
						onClick={() => layout.closePlaybook()}
						data-testid="playbook-close-button"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<Separator />
			</div>

			{/* Main content */}
			<div className="flex min-h-0 flex-1 flex-col gap-2.5">
				{/* Control bar */}
				<div className="flex shrink-0 items-center justify-between">
					<Checkbox
						checked={allSelected ? true : someSelected ? "indeterminate" : false}
						onCheckedChange={(checked) => handleSelectAll(checked === true)}
						data-testid="playbook-select-all"
					/>
					<label
						className="ml-2 mr-auto cursor-pointer select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-foreground"
						onClick={() => handleSelectAll(!allSelected)}
					>
						{t("playbook.selectAll")}
					</label>

					{selectedIds.size > 0 ? (
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								className="h-9 shadow-xs"
								onClick={handleCancelSelection}
								data-testid="playbook-cancel-selection-button"
							>
								{t("playbook.cancelSelection")}
							</Button>
							<Button
								variant="destructive"
								className="h-9 gap-2 shadow-xs"
								onClick={handleBatchDeleteClick}
								data-testid="playbook-batch-delete-button"
							>
								<Trash2 className="h-4 w-4" />
								{t("playbook.batchDelete", { count: selectedIds.size })}
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<Select value={filterValue} onValueChange={setFilterValue}>
								<SelectTrigger
									className="h-9 w-[120px] shadow-xs"
									data-testid="playbook-filter-select"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("playbook.filter.all")}</SelectItem>
									<SelectItem value="enabled">
										{t("playbook.filter.enabled")}
									</SelectItem>
									<SelectItem value="disabled">
										{t("playbook.filter.disabled")}
									</SelectItem>
								</SelectContent>
							</Select>

							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={searchValue}
									onChange={(e) => setSearchValue(e.target.value)}
									placeholder={t("playbook.searchPlaceholder")}
									className="h-9 pl-9 shadow-xs"
									data-testid="playbook-search-input"
								/>
							</div>

							<Button
								variant="outline"
								className="h-9 shadow-xs"
								onClick={handleReset}
								data-testid="playbook-reset-button"
							>
								{t("playbook.reset")}
							</Button>

							<Separator orientation="vertical" className="!h-5" />

							<Button
								className="h-9 shadow-xs"
								onClick={handleCreateScene}
								data-testid="playbook-create-button"
							>
								<CirclePlus className="h-4 w-4" />
								{t("playbook.create")}
							</Button>
						</div>
					)}
				</div>

				{/* Scene list */}
				<div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-border p-2">
					{isLoading ? (
						<div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							{t("playbook.loading")}
						</div>
					) : error ? (
						<div
							className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-destructive"
							data-testid="playbook-error"
						>
							<span>{error}</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void playbook.fetchScenes()}
								data-testid="playbook-error-retry"
							>
								{t("playbook.retry")}
							</Button>
						</div>
					) : filteredScenes.length === 0 ? (
						<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
							{t("playbook.noData")}
						</div>
					) : (
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={filteredScenes.map((s) => s.id)}
								strategy={verticalListSortingStrategy}
							>
								<div className="flex flex-col">
									{filteredScenes.map((scene, index) => (
										<>
											{index > 0 && <Separator className="my-1" />}
											<SceneRow
												key={scene.id}
												scene={scene}
												selected={selectedIds.has(scene.id)}
												onSelect={handleSelectOne}
												onToggleEnabled={handleToggleEnabled}
												onAction={handleAction}
											/>
										</>
									))}
								</div>
							</SortableContext>
						</DndContext>
					)}
				</div>
			</div>
		</div>
	)
})
