import type { PropsWithChildren } from "react"
import { createContext, useMemo } from "react"
import type {
	SensorDescriptor,
	SensorOptions,
	CollisionDetection,
	DragEndEvent,
	DragOverEvent,
	DragStartEvent,
	DragMoveEvent,
} from "@dnd-kit/core"
import type { LabeledValue, DefaultOptionType } from "antd/es/select"
import { useMemoizedFn } from "ahooks"
import type { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import type { WithPage } from "@/types/common"
import type { DragState, State, GroupItem as GroupItemType } from "../types"
import { useModeConfigState } from "../hooks/useModeConfigState"
import { useModeConfigActions } from "../hooks/useModeConfigActions"
import useDragHandler from "../hooks/useDragHandler"

export interface ModeConfigContextValue {
	// === 状态 ===
	/* 分组列表 */
	groupList: Map<string, GroupItemType>
	/* 模式详情 */
	modeDetail: PlatformPackage.ModeDetail | null
	/* 状态 */
	state: State
	/* 拖拽状态 */
	dragState: DragState
	/* 加载状态 */
	loading: boolean
	/* 左侧模型列表 */
	leftModelList: AiManage.ModelInfo[]
	/* 跟随模式选项 */
	flowModeOptions: DefaultOptionType[]
	/* 跟随模式列表 */
	flowModeList: WithPage<PlatformPackage.Mode>
	/* 跟随模式加载状态 */
	flowModeLoading: boolean
	info?: PlatformPackage.Mode | null

	// === 状态设置器 ===
	setGroupList: React.Dispatch<React.SetStateAction<Map<string, GroupItemType>>>
	setModeDetail: React.Dispatch<React.SetStateAction<PlatformPackage.ModeDetail | null>>
	setDragState: (fn: (draft: DragState) => void) => void

	// === 分组操作 ===
	deleteGroup: (group: PlatformPackage.ModeGroup) => void
	openAddOrEditGroupModal: (group?: PlatformPackage.ModeGroup) => void

	// === 模型操作 ===
	editModel: (model: PlatformPackage.DynamicModel) => void
	changeModel: (
		model: PlatformPackage.DynamicModel,
		values: Partial<PlatformPackage.DynamicModel>,
	) => void
	deleteModel: (groupId: string, modelId: string, subGroupId?: string) => void

	// === 配置操作 ===
	changeDistributionType: (type: PlatformPackage.DistributionType) => Promise<void>
	changeFlowMode: (mode: LabeledValue) => void
	getModeDetail: (id: string, isFollow?: boolean) => Promise<void>
	resetConfig: () => void

	// === 拖拽相关 ===
	sensors: SensorDescriptor<SensorOptions>[]
	collisionDetectionStrategy: CollisionDetection
	handleDragStart: (event: DragStartEvent) => void
	handleDragOver: (event: DragOverEvent) => void
	handleDragMove: (event: DragMoveEvent) => void
	handleDragEnd: (event: DragEndEvent) => void

	// === 其他 ===
	debouncedSearch: (value: string, onSuccess: () => void) => void
	wrappedGoToEdit: (data: PlatformPackage.Mode | null) => void
	fetchFlowModeList: (params: any, reset?: boolean) => Promise<void>
}

export const ModeConfigContext = createContext<ModeConfigContextValue | null>(null)

interface ModeConfigProviderProps extends PropsWithChildren {
	info?: PlatformPackage.Mode | null
	allModelList: AiManage.ModelInfo[]
	goToEdit: (data: PlatformPackage.Mode | null, onRefresh?: () => void) => void
}

export function ModeConfigProvider({
	children,
	info,
	allModelList,
	goToEdit,
}: ModeConfigProviderProps) {
	// 状态管理
	const stateHook = useModeConfigState({
		info,
		allModelList,
	})

	// 业务逻辑
	const actionsHook = useModeConfigActions({
		groupList: stateHook.groupList,
		setGroupList: stateHook.setGroupList,
		setModeDetail: stateHook.setModeDetail,
		modeDetail: stateHook.modeDetail,
	})

	// 拖拽逻辑
	const dragHook = useDragHandler({
		groupList: stateHook.groupList,
		setGroupList: stateHook.setGroupList,
		setModeDetail: stateHook.setModeDetail,
	})

	// 包装的 goToEdit 函数
	const wrappedGoToEdit = useMemoizedFn((data: PlatformPackage.Mode | null) => {
		goToEdit(data, () => {
			if (!data?.id) return
			stateHook.getModeDetail(data.id, true)
		})
	})

	const value = useMemo<ModeConfigContextValue>(
		() => ({
			// 状态
			groupList: stateHook.groupList,
			modeDetail: stateHook.modeDetail,
			state: stateHook.state,
			dragState: dragHook.dragState,
			loading: stateHook.loading,
			leftModelList: stateHook.leftModelList,
			flowModeOptions: stateHook.flowModeOptions,
			flowModeList: stateHook.flowModeList,
			flowModeLoading: stateHook.flowModeLoading,
			info,

			// 状态设置器
			setGroupList: stateHook.setGroupList,
			setModeDetail: stateHook.setModeDetail,
			setDragState: dragHook.setDragState,

			// 分组操作
			deleteGroup: actionsHook.deleteGroup,
			openAddOrEditGroupModal: actionsHook.openAddOrEditGroupModal,

			// 模型操作
			deleteModel: actionsHook.deleteModel,
			editModel: actionsHook.editModel,
			changeModel: actionsHook.changeModel,

			// 配置操作
			changeDistributionType: stateHook.changeDistributionType,
			changeFlowMode: stateHook.changeFlowMode,
			getModeDetail: stateHook.getModeDetail,
			resetConfig: actionsHook.resetConfig,

			// 拖拽相关
			sensors: dragHook.sensors,
			collisionDetectionStrategy: dragHook.collisionDetectionStrategy,
			handleDragStart: dragHook.handleDragStart,
			handleDragOver: dragHook.handleDragOver,
			handleDragMove: dragHook.handleDragMove,
			handleDragEnd: dragHook.handleDragEnd,

			// 其他
			debouncedSearch: stateHook.debouncedSearch,
			wrappedGoToEdit,
			fetchFlowModeList: stateHook.fetchFlowModeList,
		}),
		[
			stateHook.groupList,
			stateHook.modeDetail,
			stateHook.state,
			stateHook.loading,
			stateHook.leftModelList,
			stateHook.flowModeOptions,
			stateHook.flowModeList,
			stateHook.flowModeLoading,
			stateHook.setGroupList,
			stateHook.setModeDetail,
			stateHook.changeDistributionType,
			stateHook.changeFlowMode,
			stateHook.getModeDetail,
			stateHook.debouncedSearch,
			stateHook.fetchFlowModeList,

			dragHook.dragState,
			dragHook.setDragState,
			dragHook.sensors,
			dragHook.collisionDetectionStrategy,
			dragHook.handleDragStart,
			dragHook.handleDragOver,
			dragHook.handleDragMove,
			dragHook.handleDragEnd,

			actionsHook.deleteGroup,
			actionsHook.openAddOrEditGroupModal,
			actionsHook.deleteModel,
			actionsHook.editModel,
			actionsHook.resetConfig,
			actionsHook.changeModel,

			info,
			wrappedGoToEdit,
		],
	)

	return <ModeConfigContext.Provider value={value}>{children}</ModeConfigContext.Provider>
}
