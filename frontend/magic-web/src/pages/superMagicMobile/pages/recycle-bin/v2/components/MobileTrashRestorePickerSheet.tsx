import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { Spinner } from "@/components/shadcn-ui/spinner"
import {
	getMobileResourceTypeIconConfig,
	type MobileResourceTypeKind,
} from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { RESOURCE_TYPE } from "../hooks/mobileRecycleBinMappers"

const HDR_SHADOW = "0px 8px 25px 0px rgba(0,0,0,0.10)" as const

interface MobileTrashRestorePickerSheetProps {
	open: boolean
	itemTitle: string
	resourceType: number
	workspaces: Workspace[]
	projects: ProjectListItem[]
	/** True while projects for the selected workspace are being fetched. */
	isProjectsLoading?: boolean
	onWorkspaceSelect: (workspaceId: string) => void
	onClose: () => void
	onConfirm: (payload: { workspaceId: string; projectId?: string }) => void
}

interface PickerRowProps {
	resourceType: MobileResourceTypeKind
	label: string
	meta?: string
	variant: "select" | "navigate"
	selected?: boolean
	onClick: () => void
}

/** Single row in workspace/project picker list. */
function PickerRow(props: PickerRowProps) {
	const { resourceType, label, meta, variant, selected = false, onClick } = props
	const { Icon, boxClass, iconClass } = getMobileResourceTypeIconConfig(resourceType)

	return (
		<button
			type="button"
			onClick={onClick}
			className="flex min-h-[60px] w-full items-center gap-3 bg-transparent px-[14px] py-3 transition-colors active:bg-foreground/[0.04]"
		>
			<div
				className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${boxClass}`}
				aria-hidden
			>
				<Icon className={`size-5 ${iconClass}`} strokeWidth={1.75} />
			</div>
			<div className="min-w-0 flex-1 text-left">
				<p className="truncate text-[16px] leading-5 text-foreground">{label}</p>
				{meta ? (
					<p className="mt-0.5 truncate text-[12px] leading-4 text-muted-foreground">
						{meta}
					</p>
				) : null}
			</div>
			<div className="flex size-5 shrink-0 items-center justify-center">
				{variant === "navigate" ? (
					<ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
				) : selected ? (
					<div className="flex size-5 items-center justify-center rounded-full bg-primary">
						<div className="size-2 rounded-full bg-primary-foreground" />
					</div>
				) : (
					<div className="size-5 rounded-full border-2 border-border" />
				)}
			</div>
		</button>
	)
}

function Divider() {
	return <div className="h-px w-full bg-border" />
}

/**
 * Mobile bottom sheet to pick restore destination when original parent is gone.
 * Mirrors prototype TrashRestorePickerSheet using real workspace/project data.
 */
function MobileTrashRestorePickerSheet(props: MobileTrashRestorePickerSheetProps) {
	const {
		open,
		itemTitle,
		resourceType,
		workspaces,
		projects,
		isProjectsLoading = false,
		onWorkspaceSelect,
		onClose,
		onConfirm,
	} = props
	const { t } = useTranslation("super")

	const needsProject = resourceType === RESOURCE_TYPE.TOPIC || resourceType === RESOURCE_TYPE.FILE

	const [step, setStep] = useState<"workspace" | "project">("workspace")
	const [workspaceId, setWorkspaceId] = useState<string | null>(null)
	const [projectId, setProjectId] = useState<string | null>(null)

	const scrollRef = useRef<HTMLDivElement>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)

	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		setShowTopMask(el.scrollTop > 4)
		setShowBottomMask(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
	}, [])

	useEffect(() => {
		if (!open) return
		setStep("workspace")
		setWorkspaceId(null)
		setProjectId(null)
	}, [open, itemTitle])

	useEffect(() => {
		if (!open) return
		const id = requestAnimationFrame(updateMasks)
		return () => cancelAnimationFrame(id)
	}, [open, updateMasks, step, workspaceId, projects.length])

	const canConfirm = needsProject ? projectId !== null : workspaceId !== null

	const stepTitle =
		step === "workspace"
			? t("mobile.recycleBin.restorePicker.workspaceStep")
			: t("mobile.recycleBin.restorePicker.projectStep")

	const handleSelectWorkspace = useCallback(
		(id: string) => {
			setWorkspaceId(id)
			setProjectId(null)
			onWorkspaceSelect(id)
			if (needsProject) setStep("project")
		},
		[needsProject, onWorkspaceSelect],
	)

	function handleConfirm() {
		if (!workspaceId) return
		if (needsProject) {
			if (!projectId) return
			onConfirm({ workspaceId, projectId })
			return
		}
		onConfirm({ workspaceId })
	}

	function handleBack() {
		setStep("workspace")
		setProjectId(null)
	}

	const workspaceRows = useMemo(
		() =>
			workspaces.map((ws, index) => (
				<div key={ws.id}>
					{index > 0 ? <Divider /> : null}
					<PickerRow
						resourceType="workspace"
						label={ws.name}
						variant={needsProject ? "navigate" : "select"}
						selected={workspaceId === ws.id}
						onClick={() => handleSelectWorkspace(ws.id)}
					/>
				</div>
			)),
		[workspaces, needsProject, workspaceId, handleSelectWorkspace],
	)

	const projectRows = useMemo(
		() =>
			projects.map((p, index) => (
				<div key={p.id}>
					{index > 0 ? <Divider /> : null}
					<PickerRow
						resourceType="project"
						label={p.project_name?.trim() || t("common.untitledProject")}
						variant="select"
						selected={projectId === p.id}
						onClick={() => setProjectId(p.id)}
					/>
				</div>
			)),
		[projects, projectId, t],
	)

	return (
		<Sheet open={open} onOpenChange={(next) => !next && onClose()}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-auto max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="mobile-recycle-bin-restore-picker-sheet"
			>
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground/40" aria-hidden />
				</div>

				<div className="mobile-popup-action-header relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
					{step === "project" ? (
						<button
							type="button"
							onClick={handleBack}
							className="absolute left-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
							aria-label={t("mobile.recycleBin.restorePicker.backAria")}
						>
							<ChevronLeft className="size-[22px] text-foreground" />
						</button>
					) : (
						<button
							type="button"
							onClick={onClose}
							className="absolute left-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
							style={{ boxShadow: HDR_SHADOW }}
							aria-label={t("mobile.recycleBin.restorePicker.cancelAria")}
						>
							<X className="size-[22px] text-foreground" />
						</button>
					)}

					<SheetTitle className="max-w-[247px] truncate text-center text-[18px] font-medium leading-6 text-foreground">
						{t("mobile.recycleBin.restorePicker.title")}
					</SheetTitle>

					<button
						type="button"
						onClick={handleConfirm}
						disabled={!canConfirm}
						className="absolute right-[10px] top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary disabled:opacity-40"
						style={{ boxShadow: HDR_SHADOW }}
						aria-label={t("mobile.recycleBin.restorePicker.confirmAria")}
					>
						<Check className="size-[22px] text-primary-foreground" />
					</button>
				</div>

				<p className="shrink-0 px-[14px] pb-1 pt-2 text-center text-[14px] leading-5 text-muted-foreground">
					{t("mobile.recycleBin.restorePicker.description", { name: itemTitle })}
				</p>

				<p className="shrink-0 px-[14px] pb-1 pt-2 text-[13px] leading-4 text-muted-foreground">
					{stepTitle}
				</p>

				<div className="relative min-h-0 flex-1 overflow-hidden">
					<div
						ref={scrollRef}
						onScroll={updateMasks}
						className="no-scrollbar max-h-[50vh] overflow-y-auto px-[10px] pb-6 pt-2"
					>
						{step === "workspace" ? (
							workspaces.length === 0 ? (
								<div className="flex items-center justify-center rounded-lg bg-card py-10">
									<p className="text-center text-[14px] text-muted-foreground">
										{t("mobile.recycleBin.selectPathTopic.noWorkspace")}
									</p>
								</div>
							) : (
								<div className="overflow-hidden rounded-lg bg-card">
									{workspaceRows}
								</div>
							)
						) : isProjectsLoading && projects.length === 0 ? (
							<div className="flex items-center justify-center rounded-lg bg-card py-10">
								<Spinner className="size-6 text-muted-foreground" />
							</div>
						) : projects.length === 0 ? (
							<div className="flex items-center justify-center rounded-lg bg-card py-10">
								<p className="text-center text-[14px] text-muted-foreground">
									{t("mobile.recycleBin.restorePicker.emptyProjects")}
								</p>
							</div>
						) : (
							<div className="overflow-hidden rounded-lg bg-card">{projectRows}</div>
						)}
					</div>

					<div
						className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-200"
						style={{
							background:
								"linear-gradient(to bottom, var(--background) 0%, transparent 100%)",
							opacity: showTopMask ? 1 : 0,
						}}
					/>
					<div
						className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200"
						style={{
							background:
								"linear-gradient(to top, var(--background) 0%, transparent 100%)",
							opacity: showBottomMask ? 1 : 0,
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	)
}

export default memo(MobileTrashRestorePickerSheet)
