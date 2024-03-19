/**
 * 用户偏好设置相关状态和行为管理
 */
import { localStorageKeyMap } from "@/MagicFlow/constants"
import { useMemoizedFn, useMount } from "ahooks"
import { useEffect, useState } from "react"
import { Interactions } from "."
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"

export default function useInteraction() {
	const [interaction, setInteraction] = useState(Interactions.TouchPad)

	const [openInteractionSelect, setOpenInteractionSelect] = useState(false)

	const onInteractionChange = useMemoizedFn((updatedInteraction: Interactions) => {
		localStorage.setItem(localStorageKeyMap.InteractionMode, updatedInteraction)
		setInteraction(updatedInteraction)
	})

	const getInteractionMode = useMemoizedFn(() => {
		const storageInteraction = localStorage.getItem(localStorageKeyMap.InteractionMode)
		if (storageInteraction) {
			return storageInteraction as any
		}
		return Interactions.TouchPad
	})

	useMount(() => {
		setInteraction(getInteractionMode())
	})

	// 监听外部事件以关闭下拉菜单
	useEffect(() => {
		// 清理函数数组
		const cleanupFunctions = []

		// 使用事件总线注册和清理事件
		const cleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, () => {
			setOpenInteractionSelect(false)
		})
		cleanupFunctions.push(cleanup)

		// 返回清理函数
		return () => {
			cleanupFunctions.forEach((cleanup) => cleanup())
		}
	}, [])

	return {
		interaction,
		onInteractionChange,
		setOpenInteractionSelect,
		openInteractionSelect,
	}
}
