import { DEFAULT_FONT_SIZE_BASE } from "@/opensource/constants/style"

export const calculateRelativeSize = (baseSize: number | string, fontSize: number) => {
	if (typeof baseSize === "string") {
		baseSize = Number(baseSize.replace("px", ""))
	}
	return (baseSize / DEFAULT_FONT_SIZE_BASE) * fontSize
}
