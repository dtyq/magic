import { useMemo } from "react"
import { renderSlot } from "../utils/buttonRenderer"
import { GAP_SIZE_MAP } from "../constants/constant"
import type { MessageEditorProps } from "../types"
import type { ButtonRendererContext } from "../utils/buttonRenderer"

type LayoutConfig = MessageEditorProps["layoutConfig"]
type MessageEditorSize = NonNullable<MessageEditorProps["size"]>

interface UseEditorSlotContentParams {
	layoutConfig: LayoutConfig
	buttonContext: ButtonRendererContext
	size: MessageEditorSize
}

export default function useEditorSlotContent({
	layoutConfig,
	buttonContext,
	size,
}: UseEditorSlotContentParams) {
	return useMemo(
		() => ({
			topBarLeftContent: renderSlot(
				layoutConfig?.topBarLeft ?? [],
				buttonContext,
				GAP_SIZE_MAP[size],
			),
			topBarRightContent: renderSlot(
				layoutConfig?.topBarRight ?? [],
				buttonContext,
				GAP_SIZE_MAP[size],
			),
			bottomLeftContent: renderSlot(
				layoutConfig?.bottomLeft ?? [],
				buttonContext,
				GAP_SIZE_MAP[size],
			),
			bottomRightContent: renderSlot(
				layoutConfig?.bottomRight ?? [],
				buttonContext,
				GAP_SIZE_MAP[size],
			),
			outsideBottomContent: renderSlot(
				layoutConfig?.outsideBottom ?? [],
				buttonContext,
				GAP_SIZE_MAP[size],
			),
			outsideTopContent: renderSlot(
				layoutConfig?.outsideTop ?? [],
				buttonContext,
				GAP_SIZE_MAP[size],
			),
		}),
		[buttonContext, layoutConfig, size],
	)
}
