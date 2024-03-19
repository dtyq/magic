import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { Separator } from "@/opensource/components/shadcn-ui/separator"

interface FontCategory {
	label: string
	fonts: string[]
	chineseFriendly?: string[]
}

/**
 * Font categories for better organization
 */
const FONT_CATEGORIES: Record<string, FontCategory> = {
	generic: {
		label: "Generic",
		fonts: ["sans-serif", "serif", "monospace", "cursive", "fantasy"],
	},
	sansSerif: {
		label: "Sans-serif",
		fonts: [
			"Arial",
			"Helvetica",
			"Helvetica Neue",
			"Segoe UI", // Windows
			"San Francisco", // macOS
			"Roboto", // Android/Web
			"Calibri", // Windows
			"Tahoma", // Windows
			"Trebuchet MS", // Windows
			"Verdana",
			"Geneva", // macOS
			"Avenir", // macOS
			"Futura", // macOS
			"Gill Sans", // macOS
		],
		// Fonts optimized for Chinese display (used for language-based sorting)
		chineseFriendly: [
			"Arial",
			"Segoe UI", // Windows - good Chinese support
			"Tahoma", // Windows - good Chinese support
			"Helvetica",
			"Helvetica Neue",
			"San Francisco", // macOS - good Chinese support
			"Roboto",
			"Calibri",
			"Trebuchet MS",
			"Verdana",
			"Geneva",
			"Avenir",
			"Futura",
			"Gill Sans",
		],
	},
	serif: {
		label: "Serif",
		fonts: [
			"Times New Roman",
			"Georgia",
			"Cambria", // Windows
			"Palatino", // macOS
			"Palatino Linotype", // Windows
			"Garamond",
			"Baskerville", // macOS
			"Didot", // macOS
		],
	},
	monospace: {
		label: "Monospace",
		fonts: [
			"Courier New",
			"Consolas", // Windows
			"Monaco", // macOS
			"Menlo", // macOS
			"Lucida Console", // Windows
			"SF Mono", // macOS
			"Courier",
		],
	},
	chinese: {
		label: "中文字体",
		fonts: [
			"PingFang SC", // 苹方 (macOS)
			"Microsoft YaHei", // 微软雅黑 (Windows)
			"SimSun", // 宋体 (Windows)
			"SimHei", // 黑体 (Windows)
			"STHeiti", // 华文黑体 (macOS)
			"STSong", // 华文宋体 (macOS)
			"Noto Sans SC", // Google Noto
		],
	},
}

/**
 * Flatten all fonts into a single array for quick lookup
 * Includes both regular fonts and Chinese-friendly variants
 */
const ALL_FONTS = Object.values(FONT_CATEGORIES).flatMap((category) => {
	const fonts = [...category.fonts]
	if (category.chineseFriendly) {
		fonts.push(...category.chineseFriendly)
	}
	return [...new Set(fonts)] // Remove duplicates
})

interface FontFamilySelectorProps {
	value: string
	onChange: (value: string) => void
	disabled?: boolean
}

/**
 * Get category with language-optimized font order
 */
function getCategoryWithOptimizedFonts(category: FontCategory, isChinese: boolean): FontCategory {
	// Use Chinese-friendly font order for Sans-serif category when applicable
	if (isChinese && category.chineseFriendly) {
		return {
			...category,
			fonts: category.chineseFriendly,
		}
	}
	return category
}

/**
 * Get ordered font categories based on user's language
 */
function getOrderedCategories(language: string): FontCategory[] {
	const isChinese = language.startsWith("zh")

	if (isChinese) {
		// Chinese users: prioritize Chinese fonts and optimize font order
		return [
			getCategoryWithOptimizedFonts(FONT_CATEGORIES.chinese, isChinese),
			getCategoryWithOptimizedFonts(FONT_CATEGORIES.generic, isChinese),
			getCategoryWithOptimizedFonts(FONT_CATEGORIES.sansSerif, isChinese),
			getCategoryWithOptimizedFonts(FONT_CATEGORIES.serif, isChinese),
			getCategoryWithOptimizedFonts(FONT_CATEGORIES.monospace, isChinese),
		]
	}

	// English and other users: standard order
	return [
		getCategoryWithOptimizedFonts(FONT_CATEGORIES.generic, isChinese),
		getCategoryWithOptimizedFonts(FONT_CATEGORIES.sansSerif, isChinese),
		getCategoryWithOptimizedFonts(FONT_CATEGORIES.serif, isChinese),
		getCategoryWithOptimizedFonts(FONT_CATEGORIES.monospace, isChinese),
		getCategoryWithOptimizedFonts(FONT_CATEGORIES.chinese, isChinese),
	]
}

/**
 * Font family selector component with categorized fonts
 */
export function FontFamilySelector({ value, onChange, disabled }: FontFamilySelectorProps) {
	const { i18n, t } = useTranslation("super")

	const hasCustomFont = useMemo(() => {
		return value && !ALL_FONTS.includes(value)
	}, [value])

	const orderedCategories = useMemo(() => {
		return getOrderedCategories(i18n.language)
	}, [i18n.language])

	return (
		<Select value={value} onValueChange={onChange} disabled={disabled}>
			<SelectTrigger
				size="sm"
				className="h-8 w-auto gap-1.5 rounded-sm border-0 px-2 text-xs shadow-none hover:bg-accent disabled:opacity-50"
			>
				<span className="text-xs font-medium text-muted-foreground">
					{t("stylePanel.fontFamily")}
				</span>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className="max-h-[400px]">
				{/* Custom font if not in the list */}
				{hasCustomFont && (
					<>
						<div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
							Custom
						</div>
						<SelectItem value={value} className="text-xs">
							<span style={{ fontFamily: value }}>{value}</span>
						</SelectItem>
						<Separator className="my-1" />
					</>
				)}

				{/* Render fonts by category with language-based ordering */}
				{orderedCategories.map((category, categoryIndex) => (
					<div key={category.label}>
						{categoryIndex > 0 && <Separator className="my-1" />}
						<div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
							{category.label}
						</div>
						{category.fonts.map((font) => (
							<SelectItem key={font} value={font} className="text-xs">
								<span style={{ fontFamily: font }}>{font}</span>
							</SelectItem>
						))}
					</div>
				))}
			</SelectContent>
		</Select>
	)
}
