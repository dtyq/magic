import config from "@/common/const/color"
import { cloneDeep, isString, isUndefined } from "lodash"

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

export const genBaseColorByConfig = (
	c: typeof config.palette.dark | typeof config.palette.light,
	formatValue: (v: string) => string = (v) => v,
): ColorScales =>
	Object.entries(c).reduce((acc, [key, value]) => {
		const matches = key.match(/--semi-(light-)?(\w+)-?(\d)?/)

		if (!matches) {
			return acc
		}

		// 中横线转为大驼峰
		const color = ((matches[1] ?? "") + matches[2]).replace(/-(\w)/g, (_, v) => v.toUpperCase())

		if (!color) {
			return acc
		}

		const step = matches[3]

		if (!acc[color]) {
			acc[color] = {}
		}

		if (acc[color][step]) {
			return acc
		}

		if (isUndefined(step)) {
			acc[color] = formatValue(value)
		} else {
			acc[color][step] = formatValue(value)
		}

		return acc
	}, {} as any)

export const genUsageColorByConfig = (
	tokenConfig: typeof config.tokens.color.dark | typeof config.tokens.color.light,
	formatValue: (v: string) => string = (v) => v,
) => {
	return Object.entries(tokenConfig).reduce((accc, [rawKey, value]) => {
		let [usageKey, step] = rawKey.split("/")
		step = step.replace(`--semi-color-${usageKey}`, "")
		usageKey = usageKey.replace(/-(\w)/g, (_, v) => v.toUpperCase())

		if (!accc[usageKey]) {
			accc[usageKey] = {}
		}

		if (isUndefined(step) || step === "") {
			accc[usageKey] = formatValue(value)
			return accc
		}

		if (isString(accc[usageKey])) {
			accc[usageKey] = {
				default: accc[usageKey],
			}
		}

		accc[usageKey][step.slice(1)] = formatValue(value)
		return accc
	}, {} as any)
}

export const genColorUsages = (
	c: ColorScales,
	cc: typeof config.tokens.color.dark | typeof config.tokens.color.light,
): ColorUsages =>
	genUsageColorByConfig(cloneDeep(cc), (v) => {
		const parse = v.match(/rgba\((.*),(.*)\)/)
		if (!parse) {
			return v
		}

		if (parse[1].startsWith("var")) {
			const parseColor = parse[1].match(/var\(--semi-(\w+)-?(\d)?\)/)

			if (!parseColor) {
				return v
			}

			const color = parseColor[1].replace(/-(\w)/g, (_, vv) =>
				vv.toUpperCase(),
			) as keyof ColorScales
			const step = parseColor[2]

			if (!c[color]) {
				return v
			}

			if (isUndefined(step)) {
				return `rgba(${c[color]}, ${+parse[2]})`
			}

			return `rgba(${c[color]?.[Number(step)]}, ${+parse[2]})`
		}

		return `rgba(${parse[1]}, ${+parse[2]})`
	})

export const colorScales = genBaseColorByConfig(config.palette.light, (v) => `rgba(${v}, 1)`)

export const colorUsages = genColorUsages(
	genBaseColorByConfig(config.palette.light),
	config.tokens.color.light,
)

export const darkColorScales = genBaseColorByConfig(config.palette.dark, (v) => `rgba(${v}, 1)`)

export const darkColorUsages = genColorUsages(
	genBaseColorByConfig(config.palette.dark),
	config.tokens.color.dark,
)

console.log("dark", darkColorScales, darkColorUsages)
console.log("light", colorScales, colorUsages)
