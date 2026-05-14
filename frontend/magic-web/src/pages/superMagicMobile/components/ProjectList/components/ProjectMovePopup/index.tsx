import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { Input } from "antd"
import { Check, ChevronRight, Box } from "lucide-react"
import { IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import { useStyles } from "./styles"

type ProjectMovePopupMode = "move" | "saveAsProject"
type SaveAsProjectView = "form" | "workspaceSelect"

interface ProjectMovePopupConfirmPayload {
	workspaceId: string
	projectName?: string
}

interface MoveProjectPopupProps {
	open: boolean
	onClose: () => void
	onConfirm: (payload: ProjectMovePopupConfirmPayload) => void
	title?: string
	confirmText?: string
	mode?: ProjectMovePopupMode
	defaultProjectName?: string
	/** 被移动/另存为的项目当前所属工作区 ID，用于从列表中排除该工作区。若不传则回退到全局 selectedWorkspace。 */
	sourceWorkspaceId?: string
}

/**
 * 解析弹层打开时的默认目标工作区。
 * 这里优先选中“当前工作区之外的第一个工作区”，避免把移动目标误回填为原位置。
 */
function resolveInitialWorkspaceId(
	workspaces: typeof workspaceStore.workspaces,
	currentWorkspaceId?: string,
) {
	return workspaces.find((workspace) => workspace.id !== currentWorkspaceId)?.id ?? ""
}

/**
 * “另存为项目”场景的表单页。
 * 该视图只负责收集原型要求的项目名和目标工作区，不改动底层移动业务语义。
 */
function SaveAsProjectForm({
	projectName,
	workspaceName,
	onProjectNameChange,
	onOpenWorkspaceSelect,
	styles,
	t,
}: {
	projectName: string
	workspaceName: string
	onProjectNameChange: (value: string) => void
	onOpenWorkspaceSelect: () => void
	styles: ReturnType<typeof useStyles>["styles"]
	t: ReturnType<typeof useTranslation>["t"]
}) {
	return (
		<div className={styles.saveAsContent}>
			<div className={styles.sectionLabel}>{t("chat.projectNameFieldLabel")}</div>
			<div className={styles.formCard}>
				<Input
					className={styles.nameInput}
					value={projectName}
					placeholder={t("hierarchicalWorkspacePopup.inputProjectName")}
					maxLength={100}
					onChange={(event) => onProjectNameChange(event.target.value)}
					autoFocus
					data-testid="project-move-popup-name-input"
				/>
			</div>

			<div className={styles.sectionLabel}>{t("chat.workspaceLabel")}</div>
			<div className={styles.formCard}>
				<button
					type="button"
					className={styles.selectRow}
					onClick={onOpenWorkspaceSelect}
					data-testid="project-move-popup-workspace-select-trigger"
				>
					<div className={styles.selectRowValue}>
						{workspaceName || t("workspace.unnamedWorkspace")}
					</div>
					<ChevronRight className={styles.selectChevron} size={16} />
				</button>
			</div>
		</div>
	)
}

/**
 * 工作区选择列表在两个模式间共用。
 * 布局对齐 magicrewapp-prototype ChatMoreSheet 工作区二级页：圆角白卡片 + 全宽分割线 + 仅勾选表示选中（无行内图标与选中描边）。
 */
function WorkspaceSelectionList({
	workspaces,
	selectedWorkspaceId,
	onSelectWorkspace,
	styles,
	t,
}: {
	workspaces: typeof workspaceStore.workspaces
	selectedWorkspaceId: string
	onSelectWorkspace: (workspaceId: string) => void
	styles: ReturnType<typeof useStyles>["styles"]
	t: ReturnType<typeof useTranslation>["t"]
}) {
	if (workspaces.length === 0) {
		return (
			<div className={styles.emptyState}>
				<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground">
					<Box className="size-6 text-background" />
				</div>
				<div className="text-xs text-muted-foreground">
					{t("workspace.noOtherWorkspace")}
				</div>
			</div>
		)
	}

	return (
		<div className={styles.workspaceListOuter}>
			<div className={styles.workspaceListCard}>
				{workspaces.map((workspace, index) => (
					<div key={workspace.id}>
						<button
							type="button"
							className={styles.workspaceRow}
							onClick={() => onSelectWorkspace(workspace.id)}
							data-testid={`project-move-popup-workspace-row-${workspace.id}`}
						>
							<span className={styles.workspaceRowLabel}>
								{workspace.name || t("workspace.unnamedWorkspace")}
							</span>
							{selectedWorkspaceId === workspace.id ? (
								<Check
									className={styles.workspaceRowCheck}
									size={18}
									strokeWidth={2.5}
									aria-hidden
								/>
							) : null}
						</button>
						{index < workspaces.length - 1 ? (
							<div className={styles.workspaceRowDivider} aria-hidden />
						) : null}
					</div>
				))}
			</div>
		</div>
	)
}

/**
 * 统一承载普通“移动项目”和聊天场景“另存为项目”两套交互。
 * 视图层在这里分流，但提交仍复用同一套移动业务链路。
 */
function MoveProjectPopup({
	open,
	onClose,
	onConfirm,
	title,
	// confirmText 在 actionHeader 模式下不再渲染，保留 prop 以向后兼容调用者。
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	confirmText: _confirmText,
	mode = "move",
	defaultProjectName = "",
	sourceWorkspaceId,
}: MoveProjectPopupProps) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()

	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
	const [projectName, setProjectName] = useState("")
	const [saveAsView, setSaveAsView] = useState<SaveAsProjectView>("form")

	const workspaces = workspaceStore.workspaces
	const isSaveAsProjectMode = mode === "saveAsProject"

	// 优先用项目自身的所属工作区作为过滤源，避免全局 selectedWorkspace 和项目实际工作区不一致时
	// 把错误的工作区从列表中排除（例如：列表页无全局选中工作区，或用户上次进入的工作区与项目不同）。
	const excludeWorkspaceId = sourceWorkspaceId ?? workspaceStore.selectedWorkspace?.id

	const availableWorkspaces = useMemo(
		() => workspaces.filter((workspace) => workspace.id !== excludeWorkspaceId),
		[workspaces, excludeWorkspaceId],
	)
	const selectedTargetWorkspace = useMemo(
		() => availableWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
		[availableWorkspaces, selectedWorkspaceId],
	)
	const isConfirmDisabled = !selectedWorkspaceId || (isSaveAsProjectMode && !projectName.trim())
	const headerTitle =
		isSaveAsProjectMode && saveAsView === "workspaceSelect"
			? t("chat.workspaceSelectTitle")
			: title || `${t("hierarchicalWorkspacePopup.moveProjectTo")}...`

	useEffect(() => {
		if (!open) return

		void SuperMagicService.workspace.fetchWorkspaces({
			isAutoSelect: false,
			isSelectLast: true,
			page: 1,
		})

		setSelectedWorkspaceId(
			resolveInitialWorkspaceId(workspaceStore.workspaces, excludeWorkspaceId),
		)
		setProjectName(defaultProjectName)
		setSaveAsView("form")
	}, [defaultProjectName, open, excludeWorkspaceId])

	useEffect(() => {
		if (!open) return
		if (
			selectedWorkspaceId &&
			availableWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)
		) {
			return
		}

		setSelectedWorkspaceId(resolveInitialWorkspaceId(availableWorkspaces, excludeWorkspaceId))
	}, [availableWorkspaces, open, excludeWorkspaceId, selectedWorkspaceId])

	/**
	 * 统一收口确认动作。
	 * 另存为项目场景把输入框内容一并带出；普通移动场景只提交目标工作区。
	 */
	const handleConfirm = useMemoizedFn(() => {
		if (!selectedWorkspaceId) return

		onConfirm({
			workspaceId: selectedWorkspaceId,
			projectName: isSaveAsProjectMode ? projectName.trim() : undefined,
		})
	})

	/**
	 * 另存为项目的二级工作区选择页点击关闭时先回到表单页；其它场景按弹层关闭处理。
	 */
	const handleHeaderClose = useMemoizedFn(() => {
		if (isSaveAsProjectMode && saveAsView === "workspaceSelect") {
			setSaveAsView("form")
			return
		}

		onClose()
	})

	/**
	 * 另存为项目的工作区选择页需要回到表单页，避免用户在二级页丢失已输入的项目名。
	 */
	const handleSelectWorkspaceForSaveAs = useMemoizedFn((workspaceId: string) => {
		setSelectedWorkspaceId(workspaceId)
		setSaveAsView("form")
	})

	/**
	 * 保存原型式的“项目名称 + 工作区”交互，但在当前业务口径下仍然只是移动。
	 */
	const renderSaveAsProjectContent = () => {
		if (saveAsView === "workspaceSelect") {
			return (
				<div className={styles.content}>
					<WorkspaceSelectionList
						workspaces={availableWorkspaces}
						selectedWorkspaceId={selectedWorkspaceId}
						onSelectWorkspace={handleSelectWorkspaceForSaveAs}
						styles={styles}
						t={t}
					/>
				</div>
			)
		}

		return (
			<SaveAsProjectForm
				projectName={projectName}
				workspaceName={selectedTargetWorkspace?.name || ""}
				onProjectNameChange={setProjectName}
				onOpenWorkspaceSelect={() => setSaveAsView("workspaceSelect")}
				styles={styles}
				t={t}
			/>
		)
	}

	/**
	 * 普通移动项目继续使用现有列表式布局，避免这次改造把非聊天场景一并改写。
	 */
	const renderMoveContent = () => (
		<div className={styles.content}>
			<WorkspaceSelectionList
				workspaces={availableWorkspaces}
				selectedWorkspaceId={selectedWorkspaceId}
				onSelectWorkspace={setSelectedWorkspaceId}
				styles={styles}
				t={t}
			/>
		</div>
	)

	/**
	 * 两种模式统一使用 actionHeader：圆形关闭按钮（左）+ 圆形确认按钮（右）+ 居中标题，
	 * 对齐原型 ChatMoreSheet 头部布局，移除底部"确认移动"按钮条。
	 * 二级「选择工作区」页不展示右上角确认：点列表行即选中并返回表单；MagicPopup 仍对 trailing 占位以保持标题居中。
	 * bg-muted 对齐原型 Sheet 背景色，使白色卡片在灰色底上自然分层。
	 */
	return (
		<MagicPopup
			className="bg-muted"
			bodyClassName={cx(
				styles.container,
				isSaveAsProjectMode && styles.saveAsContainer,
				"bg-muted",
			)}
			visible={open}
			onClose={onClose}
			title={typeof headerTitle === "string" ? headerTitle : undefined}
			headerVariant="actionHeader"
			headerTitle={headerTitle}
			headerLeadingAction={{
				icon: <IconX className="size-5" />,
				ariaLabel: t("common.cancel"),
				onClick: handleHeaderClose,
				testId: "project-move-popup-close",
			}}
			headerTrailingAction={
				// 另存为二级工作区选择页：点行即完成选择，不需要独立确认按钮。
				isSaveAsProjectMode && saveAsView === "workspaceSelect"
					? undefined
					: {
							icon: <Check className="size-[22px]" strokeWidth={2.5} />,
							ariaLabel: t("common.confirm"),
							onClick: handleConfirm,
							disabled: isConfirmDisabled,
							// 另存为模式用主色调；移动模式也用主色调，与原型 workspaceSelect 确认按钮一致。
							tone: "primary",
							testId: "project-move-popup-confirm",
						}
			}
			data-testid="project-move-popup"
		>
			{isSaveAsProjectMode ? renderSaveAsProjectContent() : renderMoveContent()}
		</MagicPopup>
	)
}

export default observer(MoveProjectPopup)
