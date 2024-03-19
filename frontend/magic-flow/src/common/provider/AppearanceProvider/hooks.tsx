import { DEFAULT_FONT_SIZE_BASE } from "@/common/const/style"
import type { SizeType } from "antd/es/config-provider/SizeContext"
import { useMemo } from "react"
import { useAppearanceStore } from "./context"

export const useChatFontSize = () => {
	const fontSize = useAppearanceStore((state) => state.chatFontSize) ?? DEFAULT_FONT_SIZE_BASE
	const buttonSize = useMemo<SizeType>(() => {
		if (fontSize <= 12) {
			return "small"
		}
		if (fontSize > 12 && fontSize <= 18) {
			return "middle"
		}
		return "large"
	}, [fontSize])

	return { fontSize, buttonSize }
}

export const changeChatFontSize = (size: number) =>
	useAppearanceStore.setState({ chatFontSize: size })
