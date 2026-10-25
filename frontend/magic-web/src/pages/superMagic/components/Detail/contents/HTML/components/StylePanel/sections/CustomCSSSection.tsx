import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Code2, RotateCcw } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MonacoEditor } from "@/infrastructure/editors/monaco"
import type { Monaco } from "@/infrastructure/editors/monaco"
import { cn } from "@/utils/cn"
import type { SelectedElementInfo } from "../types"
import { STYLE_PANEL_STYLES } from "../styles"
import { parseCSSDeclarations, serializeCSSDeclarations } from "../utils/cssDeclarations"

interface CustomCSSSectionProps {
	selectedElement: SelectedElementInfo | null
	disabled?: boolean
	onApply: (styles: Record<string, string>) => Promise<void> | void
}

const CSS_DECLARATION_LANGUAGE = "magic-css-declarations"
let cssDeclarationLanguageRegistered = false

function registerCSSDeclarationLanguage(monaco: Monaco): void {
	if (cssDeclarationLanguageRegistered) return

	monaco.languages.register({ id: CSS_DECLARATION_LANGUAGE })
	monaco.languages.setMonarchTokensProvider(CSS_DECLARATION_LANGUAGE, {
		tokenizer: {
			root: [
				[/\/\*[\s\S]*?\*\//, "comment"],
				[/--?[a-zA-Z0-9_-]+(?=\s*:)/, "attribute.name"],
				[/[a-zA-Z][a-zA-Z0-9-]*(?=\s*:)/, "attribute.name"],
				[/#[0-9a-fA-F]{3,8}\b/, "number.hex"],
				[/\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?\b/, "number"],
				[/(?:!important)\b/, "keyword"],
				[/(?:[;:])/, "delimiter"],
				[/(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/, "string"],
			],
		},
	})
	cssDeclarationLanguageRegistered = true
}

export function CustomCSSSection({
	selectedElement,
	disabled = false,
	onApply,
}: CustomCSSSectionProps) {
	const { t } = useTranslation("super")
	const [value, setValue] = useState("")
	const [baseline, setBaseline] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [isApplying, setIsApplying] = useState(false)
	const selectedSelectorRef = useRef<string | undefined>(undefined)
	const isDirty = value !== baseline
	const isDirtyRef = useRef(isDirty)
	isDirtyRef.current = isDirty
	const serializedInlineStyles = useMemo(
		() => serializeCSSDeclarations(selectedElement?.inlineStyles ?? {}),
		[selectedElement?.inlineStyles],
	)

	useEffect(() => {
		const selector = selectedElement?.selector
		const selectionChanged = selectedSelectorRef.current !== selector
		selectedSelectorRef.current = selector

		if (selectionChanged || !isDirtyRef.current) {
			setValue(serializedInlineStyles)
			setBaseline(serializedInlineStyles)
			setError(null)
		}
	}, [selectedElement?.selector, serializedInlineStyles])

	const validate = (nextValue: string): boolean => {
		const result = parseCSSDeclarations(nextValue)
		const nextError = result.error ? t("stylePanel.customCSS.invalidError") : null
		setError(nextError)
		return !result.error
	}

	const handleApply = async () => {
		if (!isDirty || !validate(value)) return

		const result = parseCSSDeclarations(value)
		const previousResult = parseCSSDeclarations(baseline)
		if (result.error || previousResult.error) return

		const stylesToApply = { ...result.styles }
		Object.keys(previousResult.styles).forEach((property) => {
			if (!(property in result.styles)) stylesToApply[property] = ""
		})
		if (Object.keys(stylesToApply).length === 0) return

		setError(null)
		setIsApplying(true)
		try {
			await onApply(stylesToApply)
			setBaseline(value)
		} catch (applyError) {
			console.error("[CustomCSSSection] Failed to apply CSS declarations:", applyError)
			setError(t("stylePanel.customCSS.applyError"))
		} finally {
			setIsApplying(false)
		}
	}

	const handleClear = () => {
		setValue("")
		setError(null)
	}

	return (
		<div className={cn(STYLE_PANEL_STYLES.section, "border-t border-border/60 pt-2")}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<div className="text-xs font-semibold leading-4 text-foreground">
						{t("stylePanel.customCSS.title")}
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 shrink-0 gap-1 px-1.5 text-[11px]"
					disabled={disabled || !value}
					onClick={handleClear}
				>
					<RotateCcw className="h-3 w-3" />
					{t("stylePanel.customCSS.clear")}
				</Button>
			</div>
			<p className="text-[11px] leading-4 text-muted-foreground">
				{t("stylePanel.customCSS.description")}
			</p>
			<div
				className={cn(
					"h-44 min-h-32 overflow-hidden rounded-md border border-border/70 bg-background/70",
					disabled || !selectedElement ? "opacity-60" : "",
				)}
				aria-label={t("stylePanel.customCSS.title")}
				aria-invalid={Boolean(error)}
			>
				<MonacoEditor
					height="100%"
					language={CSS_DECLARATION_LANGUAGE}
					value={value}
					onChange={(nextValue) => {
						const nextText = nextValue ?? ""
						setValue(nextText)
						if (nextText.trim()) validate(nextText)
						else setError(null)
					}}
					onMount={(editor, monaco) => {
						registerCSSDeclarationLanguage(monaco)
						editor.onKeyDown((event) => {
							if (
								(event.browserEvent.metaKey || event.browserEvent.ctrlKey) &&
								event.browserEvent.key === "Enter"
							) {
								event.preventDefault()
								void handleApply()
							}
						})
					}}
					options={{
						readOnly: disabled || !selectedElement || isApplying,
						fontSize: 11,
						lineHeight: 18,
						fontFamily:
							"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
						minimap: { enabled: false },
						lineNumbers: "on",
						wordWrap: "on",
						automaticLayout: true,
						scrollBeyondLastLine: false,
						padding: { top: 8, bottom: 8 },
						overviewRulerLanes: 0,
						renderLineHighlight: "none",
						quickSuggestions: false,
						suggestOnTriggerCharacters: false,
					}}
				/>
			</div>
			{error ? <p className="text-[11px] leading-4 text-destructive">{error}</p> : null}
			{isDirty ? (
				<Button
					variant="secondary"
					size="sm"
					className="h-7 w-full text-xs"
					disabled={disabled || !selectedElement || Boolean(error) || isApplying}
					onClick={() => void handleApply()}
				>
					{isApplying
						? t("stylePanel.customCSS.applying")
						: t("stylePanel.customCSS.apply")}
				</Button>
			) : null}
		</div>
	)
}
