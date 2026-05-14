import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRequest } from "ahooks"
import { toast } from "sonner"
import { FUNCTION_PERMISSION_CODE, type MagicClawItem, MagicClawApi } from "@/apis"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { usePoppinsFont } from "@/styles/font"
import useGeistFont from "@/styles/fonts/geist"
import { useTranslation } from "react-i18next"
import { EMPTY_MAGIC_CLAW_LIST, MAGI_CLAW_LIST_POLLING_INTERVAL } from "./constants"
import type { MagiClawCreatePayload } from "./MagiClawCreateDialog"
import { confirmMagiClawSandboxUpgrade } from "./magiClawSandboxUpgradeConfirm"
import { useMagiClawCreatedSectionActions } from "./useMagiClawCreatedSectionActions"

export interface MagiClawContextMenuAnchorRect {
	top: number
	left: number
	right: number
	bottom: number
	width: number
	height: number
}

export interface MagiClawContextMenuState {
	claw: MagicClawItem
	anchorRect: MagiClawContextMenuAnchorRect
}

export interface MagiClawEditPayload {
	name: string
	icon?: string | null
}

/**
 * 为列表行生成稳定的业务 test id，避免依赖顺序或展示文案。
 */
export function getMagiClawRowId(claw: MagicClawItem) {
	return claw.code || claw.id
}

/**
 * 统一构造锚点矩形，避免菜单组件直接持有 DOM 引用。
 */
function buildContextMenuAnchorRect(anchor: HTMLElement): MagiClawContextMenuAnchorRect {
	const rect = anchor.getBoundingClientRect()
	return {
		top: rect.top,
		left: rect.left,
		right: rect.right,
		bottom: rect.bottom,
		width: rect.width,
		height: rect.height,
	}
}

/**
 * useMagiClawMobilePage 负责移动端页面的请求、弹层状态和滚动遮罩逻辑。
 */
export function useMagiClawMobilePage() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [editingClaw, setEditingClaw] = useState<MagicClawItem | null>(null)
	const [deletingClaw, setDeletingClaw] = useState<MagicClawItem | null>(null)
	const [isUpdating, setIsUpdating] = useState(false)
	const [contextMenuState, setContextMenuState] = useState<MagiClawContextMenuState | null>(null)
	const [dismissedUpgradeBadgeByClawKey, setDismissedUpgradeBadgeByClawKey] = useState<
		Record<string, boolean>
	>({})
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const { confirm, dialog } = useConfirmDialog()
	const { isAllowed: canCreateMagicClaw } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.MagicClawCreate,
	)

	usePoppinsFont()
	useGeistFont()
	useNamedPageTitle({
		pageTitle: t("superLobster.title", clawBrandValues),
	})

	const {
		data: listPayload,
		loading: listLoading,
		error: listError,
		refreshAsync: refreshClawListAsync,
	} = useRequest(
		() =>
			MagicClawApi.queryMagicClawList(
				{ page: 1, page_size: 100 },
				{ enableErrorMessagePrompt: false },
			),
		{
			refreshDeps: [],
			pollingInterval: MAGI_CLAW_LIST_POLLING_INTERVAL,
			pollingWhenHidden: false,
		},
	)

	const hasLoadedClawList = typeof listPayload !== "undefined"
	const visibleListLoading = listLoading && !hasLoadedClawList
	const visibleListError = hasLoadedClawList ? undefined : listError
	const claws = useMemo(() => listPayload?.list ?? EMPTY_MAGIC_CLAW_LIST, [listPayload])
	const hasClaws = claws.length > 0
	const createButtonLabel = canCreateMagicClaw
		? t("superLobster.created.create", clawBrandValues)
		: t("superLobster.created.noCreatePermission")

	const {
		activeActionClawCode,
		getDisplayedClawStatus,
		handleDeleteClaw,
		handleOpenClawPlaygroundWithPreWarm,
		handleRestartClaw,
		handleUpgradeClaw,
		handleStartClaw,
		handleStopClaw,
	} = useMagiClawCreatedSectionActions({
		claws,
		onRefreshList: refreshClawListAsync,
		onOpenClawPlayground: handleOpenClawPlayground,
		t,
		clawBrandValues,
	})

	/**
	 * 当滚动容器内容变化时，重新计算上下渐变遮罩是否需要显示。
	 */
	const updateScrollMasks = useCallback(() => {
		const element = scrollViewportRef.current
		if (!element) return

		setShowTopMask(element.scrollTop > 4)
		setShowBottomMask(element.scrollTop + element.clientHeight < element.scrollHeight - 4)
	}, [])

	useEffect(() => {
		setDismissedUpgradeBadgeByClawKey((previousState) => {
			const nextState = { ...previousState }
			let changed = false

			for (const claw of claws) {
				const rowId = getMagiClawRowId(claw)
				if (!claw.need_upgrade && nextState[rowId]) {
					delete nextState[rowId]
					changed = true
				}
			}

			return changed ? nextState : previousState
		})
	}, [claws])

	useEffect(() => {
		const animationFrameId = requestAnimationFrame(updateScrollMasks)
		return () => cancelAnimationFrame(animationFrameId)
	}, [claws.length, hasClaws, updateScrollMasks, visibleListError, visibleListLoading])

	/**
	 * 保持对话入口的真实业务跳转，不为移动端壳层单独再造路由。
	 */
	function handleOpenClawPlayground(clawCode: string) {
		if (!clawCode) return

		navigate({
			name: RouteName.ClawPlayground,
			params: { code: clawCode },
		})
	}

	/**
	 * 升级动作继续复用现有确认逻辑，只把 badge 收敛到移动端页面状态里。
	 */
	function handleConfirmUpgradeClaw(claw: MagicClawItem) {
		const rowId = getMagiClawRowId(claw)
		confirmMagiClawSandboxUpgrade(confirm, {
			claw,
			t,
			clawBrandValues,
			onConfirm: () => {
				setDismissedUpgradeBadgeByClawKey((previousState) => ({
					...previousState,
					[rowId]: true,
				}))
				const status = getDisplayedClawStatus(claw)
				if (status === MAGIC_CLAW_STATUS.RUNNING) {
					void handleUpgradeClaw(claw)
					return
				}

				void handleStartClaw(claw)
			},
		})
	}

	/**
	 * 创建流程沿用现有 API 和创建弹层，保证先还原主页面结构再逐步 sheet 化。
	 */
	async function handleCreateClaw(payload: MagiClawCreatePayload) {
		setIsCreating(true)
		try {
			const createdClaw = await MagicClawApi.createMagicClaw({
				name: payload.name,
				template_code: payload.template_code,
				...(payload.icon ? { icon: payload.icon } : {}),
			})
			if (!createdClaw.code) {
				toast.error(t("superLobster.created.createFailed", clawBrandValues))
				return
			}

			setIsCreateDialogOpen(false)
			await refreshClawListAsync()
			handleOpenClawPlayground(createdClaw.code)
		} catch {
			toast.error(t("superLobster.created.createFailed", clawBrandValues))
		} finally {
			setIsCreating(false)
		}
	}

	/**
	 * 页面上的所有创建入口都通过同一守卫收口，避免移动端新 UI 绕过生产权限判断。
	 */
	function handleOpenCreate() {
		if (!canCreateMagicClaw) return
		setIsCreateDialogOpen(true)
	}

	/**
	 * 编辑流程先走现有更新 API，避免页面菜单只是视觉占位。
	 */
	async function handleUpdateClaw(payload: MagiClawEditPayload) {
		if (!editingClaw?.code) return

		setIsUpdating(true)
		try {
			await MagicClawApi.updateMagicClaw(
				{
					code: editingClaw.code,
					name: payload.name.trim(),
					icon: payload.icon ?? null,
				},
				{ enableErrorMessagePrompt: false },
			)
			toast.success(t("superLobster.editDialog.updateSuccess", clawBrandValues))
			setEditingClaw(null)
			await refreshClawListAsync()
		} catch {
			toast.error(t("superLobster.editDialog.updateFailed", clawBrandValues))
		} finally {
			setIsUpdating(false)
		}
	}

	/**
	 * 列表菜单关闭时统一清空当前选中项，避免悬空状态残留。
	 */
	function closeContextMenu() {
		setContextMenuState(null)
	}

	/**
	 * 使用触发按钮的几何信息定位浮层，让菜单呈现接近原型的锚点效果。
	 */
	function openContextMenu(claw: MagicClawItem, anchor: HTMLElement) {
		setContextMenuState({
			claw,
			anchorRect: buildContextMenuAnchorRect(anchor),
		})
	}

	/**
	 * 编辑操作先关闭菜单再打开弹层，避免两个浮层状态叠在一起。
	 */
	function handleOpenEditClaw(claw: MagicClawItem) {
		closeContextMenu()
		setEditingClaw(claw)
	}

	/**
	 * 删除动作先切到页面级确认 sheet，后续由确认按钮真正执行删除。
	 */
	function handleRequestDelete(claw: MagicClawItem) {
		closeContextMenu()
		setDeletingClaw(claw)
	}

	/**
	 * 删除确认 sheet 只负责决定是否执行删除，真正的业务删除仍复用既有 action hook。
	 */
	async function handleConfirmDelete() {
		if (!deletingClaw) return

		await handleDeleteClaw(deletingClaw)
		setDeletingClaw(null)
	}

	return {
		activeActionClawCode,
		canCreateMagicClaw,
		clawBrandValues,
		claws,
		contextMenuState,
		createButtonLabel,
		dialog,
		dismissedUpgradeBadgeByClawKey,
		deletingClaw,
		editingClaw,
		getDisplayedClawStatus,
		handleConfirmDelete,
		handleConfirmUpgradeClaw,
		handleCreateClaw,
		handleOpenCreate,
		handleOpenClawPlaygroundWithPreWarm,
		handleOpenEditClaw,
		handleRequestDelete,
		handleRestartClaw,
		handleStartClaw,
		handleStopClaw,
		handleUpdateClaw,
		hasClaws,
		isCreateDialogOpen,
		isCreating,
		isUpdating,
		openContextMenu,
		refreshClawListAsync,
		scrollViewportRef,
		setEditingClaw,
		setIsCreateDialogOpen,
		setDeletingClaw,
		showBottomMask,
		showTopMask,
		t,
		updateScrollMasks,
		visibleListError,
		visibleListLoading,
		closeContextMenu,
	}
}

/**
 * 统一构造展示名，避免列表与弹窗各自兜底时出现不一致。
 */
export function getMagiClawDisplayName(
	claw: MagicClawItem,
	t: (key: string, values?: Record<string, unknown>) => string,
	clawBrandValues: Record<string, unknown>,
) {
	return claw.name || t("superLobster.workspace.untitledProject", clawBrandValues)
}
