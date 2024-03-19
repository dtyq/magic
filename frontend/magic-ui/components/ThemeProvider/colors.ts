import { cloneDeep, isString, isUndefined } from "lodash-es"
import config from "./colorSchema.json"
import type { ColorScales, ColorUsages } from "./types"

const genBaseColorByConfig = (
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
			acc[color] = []
		}
		
		if (acc[color][step]) {
			return acc
		}
		
		if (isUndefined(step)) {
			acc[color] = formatValue(value)
		} else {
			acc[color][Number(step)] = formatValue(value)
		}
		
		return acc
	}, {} as any)

const genUsageColorByConfig = (
	tokenConfig: typeof config.tokens.color.dark | typeof config.tokens.color.light,
	formatValue: (v: string) => string = (v) => v,
) => {
	return Object.entries(tokenConfig).reduce((accc, [rawKey, value]) => {
		let [usageKey, step] = rawKey.split("/")
		step = step.replace(`--semi-color-${ usageKey }`, "")
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

const genColorUsages = (
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
				return `rgba(${ c[color] }, ${ +parse[2] })`
			}
			
			return `rgba(${ c[color]?.[Number(step)] }, ${ +parse[2] })`
		}
		
		return `rgba(${ parse[1] }, ${ +parse[2] })`
	})

export const colorScales = genBaseColorByConfig(config.palette.light, (v) => `rgba(${ v }, 1)`)

export const colorUsages = genColorUsages(
	genBaseColorByConfig(config.palette.light),
	config.tokens.color.light,
)

export const darkColorScales = genBaseColorByConfig(config.palette.dark, (v) => `rgba(${ v }, 1)`)

export const darkColorUsages = genColorUsages(
	genBaseColorByConfig(config.palette.dark),
	config.tokens.color.dark,
)
