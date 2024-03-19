import { useEffect, useMemo, useState } from "react"
import { Flex, message, Skeleton } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicModalProps } from "components"
import { MagicButton, MagicModal } from "components"
import { useMemoizedFn } from "ahooks"
import { DndContext, DragOverlay } from "@dnd-kit/core"
import type { AiManage } from "@/types/aiManage"
import type { PlatformPackage } from "@/types/platformPackage"
import { useApis } from "@/apis"
import { useStyles } from "./styles"
import LeftWrapper from "./components/LeftWrapper"
import DraggableModelItem from "./components/DraggableModelItem"
import RightWrapper from "./components/RightWrapper"
import GroupItem from "./components/GroupItem"
import { defaultDragState, DragType } from "./types"
import { mapToList } from "./utils"
import SortableModelItem from "./components/SortableModelItem"
import { ModeConfigProvider } from "./context/ModeConfigContext"
import { useModeConfigContext } from "./hooks/useModeConfigContext"
import DynamicModelItem from "./components/DynamicModelItem"

interface AddModelContentProps extends MagicModalProps {
	/* 模式详情 */
	info?: PlatformPackage.Mode | null
	/* 所有模型列表 */
	allModelList: AiManage.ModelInfo[]
	/* 跳转到另一个模式编辑 */
	goToEdit: (data: PlatformPackage.Mode | null, onRefresh?: () => void) => void
	onClose?: () => void
}

// 内部内容组件 - 使用 Context
function AssignModalContent({
	onCancel,
	onOk,
	onClose,
}: {
	onCancel?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onOk?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onClose?: () => void
}) {
	const { t } = useTranslation("admin/platform/mode")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const { PlatformPackageApi } = useApis()
	const [open, setOpen] = useState(true)
	const [saving, setSaving] = useState(false)

	// 从 Context 获取所有需要的状态和方法
	const {
		groupList,
		modeDetail,
		state,
		dragState,
		loading,
		info,
		getModeDetail,
		setDragState,
		sensors,
		resetConfig,
		collisionDetectionStrategy,
		handleDragStart,
		handleDragOver,
		handleDragMove,
		handleDragEnd,
	} = useModeConfigContext()

	useEffect(() => {
		if (info?.id) {
			getModeDetail(info.id)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [info?.id])

	// 监听 Shift 键状态
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Shift") {
				// console.log("Shift 键按下")
				setDragState((draft) => {
					draft.isInsertMode = true
				})
			}
		}
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Shift") {
				// console.log("Shift 键释放")
				setDragState((draft) => {
					draft.isInsertMode = false
				})
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("keyup", handleKeyUp)

		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("keyup", handleKeyUp)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const onInnerCancel = useMemoizedFn((e: React.MouseEvent<HTMLButtonElement>) => {
		setOpen(false)
		onCancel?.(e)
		onClose?.()
	})

	const onInnerOk = useMemoizedFn((e: React.MouseEvent<HTMLButtonElement>) => {
		try {
			if (!modeDetail || saving) return
			setSaving(true)
			const newModeDetail = {
				mode: {
					...modeDetail.mode,
					distribution_type: state.distributionMethod,
					follow_mode_id: state.flowMode?.value as string,
				},
				groups: mapToList(groupList),
			}
			// console.log(newModeDetail)
			PlatformPackageApi.saveModeConfig(modeDetail.mode.id, newModeDetail).then(() => {
				message.success(tCommon("message.saveSuccess"))
				onOk?.(e)
				onInnerCancel(e)
			})
		} catch (error) {
			console.error(error)
		} finally {
			setSaving(false)
		}
	})

	const title = useMemo(() => {
		return (
			<Flex gap={10} align="center">
				<div>{t("assignTitle", { name: info?.name_i18n.zh_CN || "" })}</div>
				{!modeDetail?.mode.is_default && (
					<MagicButton className={styles.resetBtn} danger onClick={resetConfig}>
						{t("resetConfig")}
					</MagicButton>
				)}
			</Flex>
		)
	}, [info?.name_i18n.zh_CN, modeDetail?.mode.is_default, resetConfig, styles.resetBtn, t])

	const afterClose = useMemoizedFn(() => {
		setDragState(() => defaultDragState)
	})

	const footer = useMemoizedFn((originNode: React.ReactNode) => {
		return (
			<Flex justify="space-between" gap={10} align="center">
				<span className={styles.saveTips}>{t("saveTips")}</span>
				<Flex justify="end" gap={10}>
					{originNode}
				</Flex>
			</Flex>
		)
	})

	return (
		<MagicModal
			centered
			width={1000}
			title={title}
			onCancel={onInnerCancel}
			open={open}
			onOk={onInnerOk}
			afterClose={afterClose}
			footer={footer}
			okText={tCommon("button.save")}
			maskClosable={false}
			classNames={{
				body: styles.modalBody,
			}}
		>
			{loading ? (
				<Flex className={styles.skeletonWrapper}>
					<Flex vertical className={styles.content} style={{ width: "40%" }}>
						<Skeleton avatar active paragraph={{ rows: 2 }} />
						<Skeleton active paragraph={{ rows: 16 }} />
					</Flex>
					<Flex vertical className={styles.content}>
						<Skeleton avatar active paragraph={{ rows: 2 }} />
						<Skeleton active paragraph={{ rows: 16 }} />
					</Flex>
				</Flex>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={collisionDetectionStrategy}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragMove={handleDragMove}
					onDragEnd={handleDragEnd}
				>
					<LeftWrapper />
					<RightWrapper />
					{dragState.activeItem && (
						<DragOverlay>
							{dragState.activeType === DragType.LeftModel && (
								<DraggableModelItem
									model={dragState.activeItem as AiManage.ModelInfo}
									dragOverlay
								/>
							)}
							{(dragState.activeType === DragType.Model ||
								dragState.activeType === DragType.SubModel) && (
								<SortableModelItem
									model={dragState.activeItem as PlatformPackage.BaseModel}
									handle
									dragOverlay
									style={{ width: "60%" }}
								/>
							)}
							{dragState.activeType === DragType.Group && (
								<GroupItem
									group={dragState.activeItem as PlatformPackage.ModeGroup}
									models={[]}
									handle
									dragOverlay
									style={{ width: "60%" }}
								/>
							)}
							{dragState.activeType === DragType.SubGroup && (
								<DynamicModelItem
									data={dragState.activeItem as PlatformPackage.DynamicModel}
									handle
									dragOverlay
									style={{ width: "60%" }}
								/>
							)}
						</DragOverlay>
					)}
				</DndContext>
			)}
		</MagicModal>
	)
}

// 外层容器组件 - 包裹 Provider
export const AssignModal = ({
	info,
	allModelList,
	onCancel,
	onOk,
	goToEdit,
	onClose,
	...rest
}: AddModelContentProps) => {
	return (
		<ModeConfigProvider info={info} allModelList={allModelList} goToEdit={goToEdit}>
			<AssignModalContent onCancel={onCancel} onOk={onOk} onClose={onClose} {...rest} />
		</ModeConfigProvider>
	)
}
