import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { WarningModal } from "components"
import { message } from "antd"
import { useApis } from "@/apis"
import { useOpenModal } from "@/hooks/useOpenModal"
import type { PlatformPackage } from "@/types/platformPackage"
import type { Info } from "../../AddGroupModal"
import { AddGroupModal } from "../../AddGroupModal"
import type { GroupItem as GroupItemType } from "../types"
import { listToMap, mapToList } from "../utils"

interface UseModeConfigActionsProps {
	groupList: Map<string, GroupItemType>
	setGroupList: React.Dispatch<React.SetStateAction<Map<string, GroupItemType>>>
	setModeDetail: React.Dispatch<React.SetStateAction<PlatformPackage.ModeDetail | null>>
	modeDetail: PlatformPackage.ModeDetail | null
}

export function useModeConfigActions({
	groupList,
	setGroupList,
	setModeDetail,
	modeDetail,
}: UseModeConfigActionsProps) {
	const { t } = useTranslation("admin/platform/mode")
	const { t: tCommon } = useTranslation("admin/common")

	const { PlatformPackageApi } = useApis()
	const openModal = useOpenModal()

	// 重置配置
	const resetConfig = useMemoizedFn(() => {
		openModal(WarningModal, {
			open: true,
			title: t("confirmResetConfig"),
			content: t("confirmResetConfigDesc"),
			showDeleteText: false,
			okText: t("confirmReset"),
			zIndex: 1002,
			onOk: () => {
				PlatformPackageApi.getDefaultMode().then((res) => {
					if (!modeDetail) return
					const newGroup = res?.groups?.map((item) => {
						return {
							models: item.models,
							group: {
								...item.group,
								mode_id: modeDetail?.mode.id,
							},
						}
					})

					setModeDetail({
						...modeDetail,
						groups: newGroup,
					})
					setGroupList(listToMap(newGroup))
					message.success(tCommon("message.actionSuccess"))
				})
			},
		})
	})

	// 更新分组列表和模式详情的公共函数
	const updateGroupListAndModeDetail = useMemoizedFn(
		(newGroupMap: Map<string, GroupItemType>) => {
			setGroupList(newGroupMap)
			setModeDetail((prev) => {
				if (!prev) return null
				return {
					...prev,
					groups: mapToList(newGroupMap),
				}
			})
		},
	)

	// 更新模型信息
	const changeModel = useMemoizedFn(
		(model: PlatformPackage.DynamicModel, values: Partial<PlatformPackage.DynamicModel>) => {
			const newGroupMap = new Map(groupList)
			const groupItem = newGroupMap.get(model.group_id)
			if (groupItem) {
				const newModels = new Map(groupItem.models)
				newModels.set(model.id, { ...model, ...values })
				// 创建新的 groupItem 对象，包含更新后的 models
				const newGroupItem = { ...groupItem, models: newModels }
				// 将更新后的 groupItem 设置回 newGroupMap
				newGroupMap.set(model.group_id, newGroupItem)
			}
			updateGroupListAndModeDetail(newGroupMap)
			message.success(tCommon("message.updateSuccess"))
		},
	)

	// 编辑动态模型
	const editModel = useMemoizedFn((model: PlatformPackage.DynamicModel) => {
		openModal(AddGroupModal, {
			isModel: true,
			zIndex: 1002,
			info: {
				icon: model.model_icon,
				name: model.model_translate.name || {
					zh_CN: model.model_name,
					en_US: "Dynamic Model",
				},
				model_id: model.model_id,
				description: model.model_translate.description,
			},
			onOk: (values: Info) => {
				const newGroupMap = new Map(groupList)
				const groupItem = newGroupMap.get(model.group_id)
				if (groupItem) {
					const newModels = new Map(groupItem.models)

					newModels.set(model.id, {
						...model,
						model_icon: values.icon,
						model_name: values.name.zh_CN || "",
						model_description: values.description?.zh_CN || "",
						model_id: values.model_id || "",
						model_translate: {
							name: values.name,
							description: values.description,
						},
					})
					newGroupMap.set(model.group_id, { ...groupItem, models: newModels })
					updateGroupListAndModeDetail(newGroupMap)
					message.success(tCommon("message.updateSuccess"))
				}
			},
		})
	})

	// 删除模型
	const deleteModel = useMemoizedFn((groupId: string, modelId: string, subGroupId?: string) => {
		// 获取模型名称用于显示
		const groupItem = groupList.get(groupId)
		let model = groupItem?.models.get(modelId)
		let modelName = model?.model_name || model?.model_id || ""

		if (subGroupId) {
			model = groupItem?.models.get(subGroupId)
			const dynamicModel = model as PlatformPackage.DynamicModel
			modelName =
				dynamicModel?.aggregate_config.models.find((m) => m.id === modelId)?.model_name ||
				""
		}

		openModal(WarningModal, {
			open: true,
			zIndex: 1002,
			content: modelName,
			onOk: () => {
				const newGroupMap = new Map(groupList)
				if (groupItem) {
					const newModels = new Map(groupItem.models)
					// 删除子模型
					if (subGroupId) {
						const dynamicModel = newModels.get(
							subGroupId,
						) as PlatformPackage.DynamicModel
						const newSubModels = dynamicModel?.aggregate_config.models.filter(
							(m) => m.id !== modelId,
						)
						dynamicModel.aggregate_config.models = newSubModels || []
						newModels.set(subGroupId, dynamicModel)
						newGroupMap.set(groupId, { ...groupItem, models: newModels })
					} else {
						// 删除普通模型
						newModels.delete(modelId)
						newGroupMap.set(groupId, { ...groupItem, models: newModels })
					}
				}
				updateGroupListAndModeDetail(newGroupMap)
				message.success(tCommon("message.deleteSuccess"))
			},
		})
	})

	// 删除分组
	const deleteGroup = useMemoizedFn((group: PlatformPackage.ModeGroup) => {
		openModal(WarningModal, {
			open: true,
			content: group.name_i18n?.zh_CN || "",
			zIndex: 1002,
			onOk: async () => {
				PlatformPackageApi.deleteModeGroup(group.id).then(() => {
					message.success(tCommon("message.deleteSuccess"))
					const newGroupMap = new Map(groupList)
					newGroupMap.delete(group.id)
					updateGroupListAndModeDetail(newGroupMap)
				})
			},
		})
	})

	// 添加/更新分组（内部处理）
	const addOrUpdateGroupInternal = useMemoizedFn(
		async (
			group: PlatformPackage.AddModeGroupParams | PlatformPackage.ModeGroup,
		): Promise<void> => {
			try {
				// 更新分组
				if (group?.id) {
					const res = await PlatformPackageApi.updateModeGroup(
						group.id,
						group as PlatformPackage.ModeGroup,
					)
					message.success(tCommon("message.updateSuccess"))
					const newGroupMap = new Map(groupList)
					const groupItem = newGroupMap.get(group.id)
					if (groupItem) {
						newGroupMap.set(group.id, { ...groupItem, group: res })
					}
					updateGroupListAndModeDetail(newGroupMap)
				} else {
					// 创建分组
					const res = await PlatformPackageApi.createModeGroup(group)
					message.success(tCommon("message.saveSuccess"))
					const newGroupMap = new Map(groupList)
					newGroupMap.set(res.id, {
						group: res,
						models: new Map(),
					})
					updateGroupListAndModeDetail(newGroupMap)
				}
			} catch (error) {
				console.error("Failed to save mode group:", error)
				throw error
			}
		},
	)

	// 打开添加/编辑分组弹窗
	const openAddOrEditGroupModal = useMemoizedFn((group?: PlatformPackage.ModeGroup) => {
		const modeId = modeDetail?.mode?.id
		if (!modeId) {
			console.error("Cannot open group modal: modeDetail or mode.id is missing")
			return
		}

		const info = group
			? {
					name: {
						zh_CN: group.name_i18n?.zh_CN || "",
						en_US: group.name_i18n?.en_US || "",
					},
					icon: group.icon,
				}
			: null

		openModal(AddGroupModal, {
			info,
			zIndex: 1002,
			onOk: (values: Info) => {
				const newGroup = {
					...(group || {}),
					icon: values.icon,
					name_i18n: values.name,
					mode_id: modeId,
				}
				addOrUpdateGroupInternal(newGroup)
			},
		})
	})

	return {
		resetConfig,
		editModel,
		changeModel,
		deleteModel,
		deleteGroup,
		openAddOrEditGroupModal,
	}
}
