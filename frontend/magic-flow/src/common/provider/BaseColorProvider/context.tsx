import {
	colorScales,
	colorUsages,
	type ColorScales,
	type ColorUsages,
} from "@/common/utils/palettes"
import { createContext } from "react"

export const BaseColorContext = createContext<{
	colorScales: ColorScales
	colorUsages: ColorUsages
}>({
	colorScales,
	colorUsages,
})
