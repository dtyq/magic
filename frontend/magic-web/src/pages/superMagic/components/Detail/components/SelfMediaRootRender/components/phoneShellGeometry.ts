export type PhoneShellProfile =
	"modern" | "home-button" | "notch" | "punch-hole" | "tablet" | "foldable" | "flip"

export interface PhoneShellInsets {
	left: number
	right: number
	top: number
	bottom: number
}

/** 仅表示外观装饰占位，不是设备的系统 safe-area 或物理屏幕参数。 */
export function getPhoneShellInsets(
	profile: PhoneShellProfile,
	landscape: boolean,
	posture?: "folded" | "unfolded",
): PhoneShellInsets {
	if (profile === "foldable" || profile === "flip")
		return posture === "unfolded"
			? { left: 12, right: 12, top: 36, bottom: 24 }
			: { left: 10, right: 10, top: 44, bottom: 26 }
	if (profile === "tablet") return { left: 20, right: 20, top: 46, bottom: 34 }
	if (landscape)
		return profile === "home-button"
			? { left: 64, right: 74, top: 10, bottom: 10 }
			: { left: 38, right: 9, top: 9, bottom: 24 }
	if (profile === "home-button") return { left: 10, right: 10, top: 64, bottom: 74 }
	if (profile === "punch-hole") return { left: 9, right: 9, top: 48, bottom: 25 }
	return { left: 9, right: 9, top: 54, bottom: 28 }
}

export const NO_PHONE_SHELL_INSETS: PhoneShellInsets = { left: 0, right: 0, top: 0, bottom: 0 }

interface PhoneShellAppearance {
	radius: number
	glassRadius: number
	cameraWidth: number
	cameraHeight: number
	cameraTop: number
	statusCenter: number
}

const PHONE_SHELL_APPEARANCES: Record<PhoneShellProfile, PhoneShellAppearance> = {
	modern: {
		radius: 53,
		glassRadius: 44,
		cameraWidth: 120,
		cameraHeight: 34,
		cameraTop: 15,
		statusCenter: 32,
	},
	notch: {
		radius: 53,
		glassRadius: 44,
		cameraWidth: 155,
		cameraHeight: 29,
		cameraTop: 9,
		statusCenter: 32,
	},
	"home-button": {
		radius: 32,
		glassRadius: 2,
		cameraWidth: 53,
		cameraHeight: 5,
		cameraTop: 30,
		statusCenter: 26,
	},
	"punch-hole": {
		radius: 39,
		glassRadius: 30,
		cameraWidth: 14,
		cameraHeight: 14,
		cameraTop: 17,
		statusCenter: 26,
	},
	tablet: {
		radius: 28,
		glassRadius: 14,
		cameraWidth: 7,
		cameraHeight: 7,
		cameraTop: 8,
		statusCenter: 34,
	},
	foldable: {
		radius: 25,
		glassRadius: 17,
		cameraWidth: 82,
		cameraHeight: 21,
		cameraTop: 14,
		statusCenter: 26,
	},
	flip: {
		radius: 25,
		glassRadius: 17,
		cameraWidth: 14,
		cameraHeight: 14,
		cameraTop: 14,
		statusCenter: 26,
	},
}

interface PhoneShellGeometry extends PhoneShellAppearance {
	glassInsets: PhoneShellInsets
	contentClipPath: string
}

export function getPhoneShellGeometry(
	profile: PhoneShellProfile,
	landscape: boolean,
	posture?: "folded" | "unfolded",
): PhoneShellGeometry {
	const appearance = PHONE_SHELL_APPEARANCES[profile]
	const contentInsets = getPhoneShellInsets(profile, landscape, posture)
	const glassEdge = profile === "tablet" ? 20 : 9
	const glassInsets =
		profile === "home-button"
			? contentInsets
			: { left: glassEdge, right: glassEdge, top: glassEdge, bottom: glassEdge }
	// 内容区与内屏共用轮廓，只换算绘制坐标，不缩减视口或改变滚动范围。
	// 例：顶部内容占位 54px、内屏边距 9px，裁切上边界相对内容为 -45px。
	const clipInsets = (["top", "right", "bottom", "left"] as const)
		.map((edge) => `${glassInsets[edge] - contentInsets[edge]}px`)
		.join(" ")
	return {
		...appearance,
		glassInsets,
		contentClipPath: `inset(${clipInsets} round ${appearance.glassRadius}px)`,
	}
}
