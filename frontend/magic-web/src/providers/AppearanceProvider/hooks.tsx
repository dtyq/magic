import { useMemo } from "react"
import type { SizeType } from "antd/es/config-provider/SizeContext"
import { DEFAULT_FONT_SIZE_BASE } from "@/constants/style"
import { useAppearanceStore } from "./context"

export const changeChatFontSize = (size: number) =>
	useAppearanceStore.setState({ chatFontSize: size })

export function useFontSize() {
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
