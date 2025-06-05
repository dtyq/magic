import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { autorun } from "mobx"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { interfaceStore } from "@/opensource/stores/interface"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/FilePreviewStore"
import { calculatePanelSizes, LAYOUT_CONSTANTS, PanelIndex } from "../utils/panelSizeCalculator"

/**
 * 面板尺寸管理Hook
 * 负责管理聊天界面的面板尺寸计算和状态更新
 */
export function usePanelSizes() {
	const totalWidth = useRef(window.innerWidth - LAYOUT_CONSTANTS.WINDOW_MARGIN)
	const mainMinWidth = calculatePanelSizes.getMainMinWidth(conversationStore.topicOpen)

	const [sizes, setSizes] = useState<(number | undefined)[]>(
		calculatePanelSizes.getTwoPanelSizes(
			totalWidth.current,
			interfaceStore.chatSiderDefaultWidth,
		),
	)

	// 处理侧边栏调整
	const handleSiderResize = useMemoizedFn((size: number[]) => {
		interfaceStore.setChatSiderDefaultWidth(size[0])

		setSizes((prevSizes) =>
			calculatePanelSizes.handleSiderResize(
				prevSizes,
				size,
				totalWidth.current,
				mainMinWidth,
			),
		)
	})

	// 处理输入框调整
	const handleInputResize = useMemoizedFn((size: number[]) => {
		interfaceStore.setChatInputDefaultHeight(size[2])
	})

	// 处理话题面板开关的布局调整
	useEffect(() => {
		return autorun(() => {
			const currentMainMinWidth = calculatePanelSizes.getMainMinWidth(
				conversationStore.topicOpen,
			)

			if (conversationStore.topicOpen) {
				setSizes((prevSizes) => {
					// 两面板模式，无需调整
					if (prevSizes.length < 3) return prevSizes

					const [siderWidth, mainWidth] = prevSizes

					// 话题打开时，确保主面板满足最小宽度要求
					const adjustedMainWidth = Math.max(mainWidth ?? 0, currentMainMinWidth)
					const adjustedFilePreviewWidth =
						totalWidth.current - (siderWidth ?? 0) - adjustedMainWidth

					return [siderWidth, adjustedMainWidth, adjustedFilePreviewWidth]
				})
			} else {
				setSizes((prevSizes) => {
					// 两面板模式，无需调整
					if (prevSizes.length < 3) return prevSizes

					const [siderWidth, , filePreviewWidth] = prevSizes

					// 话题关闭时，保持原有布局
					return [
						siderWidth,
						totalWidth.current - (siderWidth ?? 0) - filePreviewWidth!,
						filePreviewWidth,
					]
				})
			}
		})
	}, [])

	// 处理文件预览面板开关的布局调整
	useEffect(() => {
		return autorun(() => {
			if (MessageFilePreviewStore.open) {
				// 文件预览打开：使用默认比例分配
				setSizes(
					calculatePanelSizes.getFilePreviewOpenSizes(
						totalWidth.current,
						interfaceStore.chatSiderDefaultWidth,
					),
				)
			} else {
				// 文件预览关闭：回到两面板模式
				setSizes((prevSizes) =>
					calculatePanelSizes.getTwoPanelSizes(
						totalWidth.current,
						prevSizes[PanelIndex.Sider] ?? interfaceStore.chatSiderDefaultWidth,
					),
				)
			}
		})
	}, [])

	return {
		sizes,
		totalWidth: totalWidth.current,
		mainMinWidth,
		handleSiderResize,
		handleInputResize,
	}
}
