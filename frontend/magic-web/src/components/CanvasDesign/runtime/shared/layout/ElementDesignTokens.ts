/**
 * Canvas 元素共享设计 token（设计稿 px）。
 * 视频编辑 / 分镜 / 音频等通过 ResponsiveElementLayout.metrics 消费缩放后的值。
 *
 * space：xs=4 / sm=12 / md=16 / lg=24
 * type：caption=28 / body=38 / title=40 / display=48
 * gap：control=16 / content=24 / section=32
 */
export const ELEMENT_DESIGN_TOKENS = {
	space: {
		xs: 12,
		sm: 16,
		md: 24,
		lg: 32,
	},
	type: {
		caption: 28,
		body: 38,
		title: 40,
		display: 48,
	},
	radius: {
		control: 12,
		card: 18,
	},
	pad: {
		/** 元素内容区左右/常用外边距。 */
		sectionInline: 32,
		/** 区块内上下 padding。 */
		section: 24,
	},
	gap: {
		/** 控件内小间距。 */
		control: 16,
		/** 标题 → 内容、中等节奏。 */
		content: 24,
		/** 列表项 / 区块分隔。 */
		section: 32,
	},
} as const

export type ElementSpaceToken = keyof typeof ELEMENT_DESIGN_TOKENS.space
export type ElementTypeToken = keyof typeof ELEMENT_DESIGN_TOKENS.type

export interface ElementDesignSpaceScale {
	xs: number
	sm: number
	md: number
	lg: number
}

export interface ElementDesignTypeScale {
	caption: number
	body: number
	title: number
	display: number
}

export interface ElementDesignRadiusScale {
	control: number
	card: number
}

export interface ElementDesignPadScale {
	sectionInline: number
	section: number
}

export interface ElementDesignGapScale {
	control: number
	content: number
	section: number
}

export interface ElementDesignMetrics {
	space: ElementDesignSpaceScale
	type: ElementDesignTypeScale
	radius: ElementDesignRadiusScale
	pad: ElementDesignPadScale
	gap: ElementDesignGapScale
	/**
	 * 强信息字号下限：避免 fitUniform/controlScale 把 display/caption 压得过小。
	 * @param preferred 期望字号（通常已含局部 scale）
	 * @param role 用于取共享下限的角色
	 */
	minType(preferred: number, role?: ElementTypeToken): number
}

export function resolveElementDesignMetrics(
	designPx: (value: number) => number,
): ElementDesignMetrics {
	const space: ElementDesignSpaceScale = {
		xs: designPx(ELEMENT_DESIGN_TOKENS.space.xs),
		sm: designPx(ELEMENT_DESIGN_TOKENS.space.sm),
		md: designPx(ELEMENT_DESIGN_TOKENS.space.md),
		lg: designPx(ELEMENT_DESIGN_TOKENS.space.lg),
	}
	const type: ElementDesignTypeScale = {
		caption: designPx(ELEMENT_DESIGN_TOKENS.type.caption),
		body: designPx(ELEMENT_DESIGN_TOKENS.type.body),
		title: designPx(ELEMENT_DESIGN_TOKENS.type.title),
		display: designPx(ELEMENT_DESIGN_TOKENS.type.display),
	}
	return {
		space,
		type,
		radius: {
			control: designPx(ELEMENT_DESIGN_TOKENS.radius.control),
			card: designPx(ELEMENT_DESIGN_TOKENS.radius.card),
		},
		pad: {
			sectionInline: designPx(ELEMENT_DESIGN_TOKENS.pad.sectionInline),
			section: designPx(ELEMENT_DESIGN_TOKENS.pad.section),
		},
		gap: {
			control: designPx(ELEMENT_DESIGN_TOKENS.gap.control),
			content: designPx(ELEMENT_DESIGN_TOKENS.gap.content),
			section: designPx(ELEMENT_DESIGN_TOKENS.gap.section),
		},
		minType: (preferred, role = "caption") => {
			const floor = designPx(ELEMENT_DESIGN_TOKENS.type[role])
			if (!Number.isFinite(preferred)) return floor
			return Math.max(floor, preferred)
		},
	}
}
