type ColorStep = [string, string, string, string, string, string, string, string, string, string]
export type ColorScaleItem<T = ColorStep> = T

export interface ColorScales {
	black: ColorScaleItem<string>
	blue: ColorScaleItem
	white: ColorScaleItem<string>
	red: ColorScaleItem
	cyan: ColorScaleItem
	grey: ColorScaleItem
	lime: ColorScaleItem
	pink: ColorScaleItem
	teal: ColorScaleItem
	amber: ColorScaleItem
	brand: ColorScaleItem
	green: ColorScaleItem
	lndigo: ColorScaleItem
	orange: ColorScaleItem
	purple: ColorScaleItem
	violet: ColorScaleItem
	yellow: ColorScaleItem
	lightBlue: ColorScaleItem
	lightGreen: ColorScaleItem
}

export type ColorUsages = {
	bg: {
		"0": string
		"1": string
		"2": string
		"3": string
		"4": string
	}
	info: {
		default: string
		hover: string
		active: string
		disabled: string
	}
	link: {
		default: string
		hover: string
		active: string
		visited: string
	}
	nav: {
		bg: string
	}
	black: string
	data: {
		"0": string
		"1": string
		"2": string
		"3": string
		"4": string
		"5": string
		"6": string
		"7": string
		"8": string
		"9": string
		"10": string
		"11": string
		"12": string
		"13": string
		"14": string
		"15": string
		"16": string
		"17": string
		"18": string
		"19": string
	}
	fill: {
		"0": string
		"1": string
		"2": string
	}
	text: {
		"0": string
		"1": string
		"2": string
		"3": string
	}
	white: string
	border: string
	danger: {
		default: string
		hover: string
		active: string
	}
	shadow: string
	default: {
		default: string
		hover: string
		active: string
	}
	primary: {
		default: string
		hover: string
		active: string
		disabled: string
	}
	success: {
		default: string
		hover: string
		active: string
		disabled: string
	}
	warning: {
		default: string
		hover: string
		active: string
	}
	tertiary: {
		default: string
		hover: string
		active: string
	}
	focus: {
		border: string
	}
	overlay: {
		bg: string
	}
	highlight: {
		default: string
		bg: string
	}
	secondary: {
		default: string
		hover: string
		active: string
		disabled: string
	}
	disabled: {
		bg: string
		fill: string
		text: string
		border: string
	}
	infoLight: {
		hover: string
		active: string
		default: string
	}
	dangerLight: {
		hover: string
		active: string
		default: string
	}
	primaryLight: {
		hover: string
		active: string
		default: string
	}
	successLight: {
		hover: string
		active: string
		default: string
	}
	warningLight: {
		hover: string
		active: string
		default: string
	}
	tertiaryLight: {
		hover: string
		active: string
		default: string
	}
	secondaryLight: {
		hover: string
		active: string
		default: string
	}
}
