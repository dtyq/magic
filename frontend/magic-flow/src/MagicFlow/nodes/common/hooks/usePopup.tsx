/**
 * 处理节点类型下拉状态和行为
 */

import { MagicFlow } from "@/MagicFlow/types/flow"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useEffect, useState } from "react"

type DropdownProps = {
	currentNode: MagicFlow.Node
	isSelected: boolean
}

export default function usePopup({ currentNode, isSelected }: DropdownProps) {
	const [openPopup, setOpenPopup] = useState(false)

	const [nodeName, setNodeName] = useState(currentNode?.name as string)

	const onNodeWrapperClick = useMemoizedFn(() => {
		setOpenPopup(false)
	})

	const closePopup = useMemoizedFn(() => {
		setOpenPopup(false)
	})

	const onDropdownClick = useMemoizedFn((event) => {
		event.preventDefault()
		event.stopPropagation()

		setOpenPopup(true)
	})

	useUpdateEffect(() => {
		if (!isSelected) {
			setOpenPopup(false)
		}
	}, [isSelected])

	useEffect(() => {
		if (currentNode?.name) {
			setNodeName(currentNode?.name)
		}
	}, [currentNode?.name])

	return {
		openPopup,
		onNodeWrapperClick,
		onDropdownClick,
		nodeName,
		setOpenPopup,
		closePopup,
	}
}
