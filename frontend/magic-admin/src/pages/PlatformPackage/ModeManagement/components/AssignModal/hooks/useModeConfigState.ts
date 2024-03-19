import { useState } from "react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import type { DefaultOptionType, LabeledValue } from "antd/es/select"
import { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import { useApis } from "@/apis"
import type { PageParams, WithPage } from "@/types/common"
import type { State, GroupItem as GroupItemType } from "../types"
import { defaultState } from "../types"
import { listToMap } from "../utils"

interface UseModeConfigStateProps {
	info?: PlatformPackage.Mode | null
	allModelList: AiManage.ModelInfo[]
}

export function useModeConfigState({ allModelList }: UseModeConfigStateProps) {
	const [loading, setLoading] = useState(true)
	const [groupList, setGroupList] = useState<Map<string, GroupItemType>>(new Map())
	const [modeDetail, setModeDetail] = useState<PlatformPackage.ModeDetail | null>(null)
	const [leftModelList, setLeftModelList] = useState<AiManage.ModelInfo[]>(allModelList)
	const [state, setState] = useState<State>(defaultState)

	// 模式列表相关状态
	const [flowModeOptions, setFlowModeOptions] = useState<DefaultOptionType[]>([])
	const [flowModeList, setFlowModeList] = useState<WithPage<PlatformPackage.Mode>>({
		list: [],
		total: 0,
	})
	const [flowModeLoading, setFlowModeLoading] = useState(false)

	const { PlatformPackageApi } = useApis()

	// 加载模式列表
	const fetchFlowModeList = useMemoizedFn(
		async (params: Required<PageParams>, reset: boolean = false) => {
			try {
				setFlowModeLoading(true)
				const res = await PlatformPackageApi.getModeList(params)

				const newList = reset ? res.list : [...flowModeList.list, ...res.list]
				setFlowModeList({
					list: newList,
					total: res.total,
				})
				setFlowModeOptions(
					newList.map((item) => ({
						label: item.name_i18n.zh_CN,
						value: item.id,
					})),
				)
			} catch (error) {
				console.error(error)
			} finally {
				setFlowModeLoading(false)
			}
		},
	)

	// 获取模式详情
	const getModeDetail = useMemoizedFn(async (id: string, isFollow: boolean = false) => {
		try {
			setLoading(true)
			const res = await PlatformPackageApi.getModelDetail(id)
			// 获取非跟随模式的模型详情
			if (!isFollow) {
				setModeDetail(res)
				const flowModeName = flowModeOptions?.find(
					(item) => item.value === res.mode?.follow_mode_id,
				)?.label
				setState({
					flowMode: {
						value: res.mode?.follow_mode_id,
						label: flowModeName,
					},
					distributionMethod: res.mode.distribution_type,
				})
			}
			setGroupList(listToMap(res.groups))
		} catch (error) {
			console.error(error)
		} finally {
			setLoading(false)
		}
	})

	const { run: debouncedSearch } = useDebounceFn(
		(value: string, onSuccess: () => void) => {
			if (value) {
				setLeftModelList(
					allModelList.filter(
						(item) => item.name?.includes(value) || item.model_id?.includes(value),
					),
				)
			} else {
				setLeftModelList(allModelList)
			}
			onSuccess?.()
		},
		{ wait: 500 },
	)

	// 切换跟随模式
	const changeFlowMode = useMemoizedFn((value: LabeledValue) => {
		const flowModeId = value.value as string
		setState({
			...state,
			flowMode: value,
		})
		getModeDetail(flowModeId, true)
	})

	// 更换模型分配方式
	const changeDistributionType = useMemoizedFn(
		async (value: PlatformPackage.DistributionType) => {
			setState((prev) => ({
				...prev,
				distributionMethod: value,
			}))
			// console.log(modeDetail?.groups)
			// 自定义模式
			if (value === PlatformPackage.DistributionType.Independent) {
				// 当前模式原始分配模式是自定义模式，则直接设置分组列表
				if (
					modeDetail?.mode.distribution_type ===
					PlatformPackage.DistributionType.Independent
				) {
					setGroupList(listToMap(modeDetail?.groups || []))
					return
				}
				// 当前模式原始分配模式是跟随模式，则获取当前模式原始信息
				const originModeInfo = await PlatformPackageApi.getModeOriginalInfo(
					modeDetail?.mode.id || "",
				)
				setGroupList(listToMap(originModeInfo?.groups || []))
				return
			}
			// 跟随模式
			if (modeDetail) {
				// 无跟随模式id
				if (modeDetail.mode.follow_mode_id === "0" || !modeDetail.mode.follow_mode_id) {
					setState((prev) => ({
						...prev,
						flowMode: null,
					}))
				} else {
					// 有跟随模式id
					getModeDetail(modeDetail.mode.follow_mode_id, true)
					const flowMode = flowModeOptions?.find(
						(item) => item.value === modeDetail.mode.follow_mode_id,
					)
					if (flowMode) {
						setState((prev) => ({
							...prev,
							flowMode: flowMode as LabeledValue,
						}))
					}
				}
			}
		},
	)

	return {
		loading,
		groupList,
		modeDetail,
		leftModelList,
		state,
		debouncedSearch,
		setGroupList,
		setModeDetail,
		setState,
		getModeDetail,
		changeFlowMode,
		changeDistributionType,
		// 模式列表相关
		flowModeOptions,
		flowModeList,
		flowModeLoading,
		fetchFlowModeList,
	}
}
