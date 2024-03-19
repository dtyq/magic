import { useState, useRef, useEffect, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { Spinner } from "@/opensource/components/shadcn-ui/spinner"
import { cn } from "@/opensource/lib/utils"
import { SuperMagicApi } from "@/opensource/apis"
import type { LlmModelItem } from "@/opensource/apis/modules/superMagic"
import { useAddModelStore } from "./context"
import { buildMatchedModelConfig } from "./store"

interface ModelDeploymentFieldProps {
	submitted: boolean
}

const ModelDeploymentField = observer(function ModelDeploymentField({
	submitted,
}: ModelDeploymentFieldProps) {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [open, setOpen] = useState(false)
	const [touched, setTouched] = useState(false)
	const [suggestions, setSuggestions] = useState<LlmModelItem[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [highlightedIndex, setHighlightedIndex] = useState(-1)
	const containerRef = useRef<HTMLDivElement>(null)
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const showError = (submitted || touched) && !store.providerModelId.trim()

	const fetchSuggestions = useCallback(async (keyword: string) => {
		if (!keyword.trim()) {
			setSuggestions([])
			return
		}
		setIsLoading(true)
		try {
			const result = await SuperMagicApi.matchLlmModels(keyword)
			setSuggestions(result?.models ?? [])
		} catch {
			setSuggestions([])
		} finally {
			setIsLoading(false)
		}
	}, [])

	function handleSelect(model: LlmModelItem) {
		store.setProviderModelId(model.id)
		store.setModelName(model.name)
		if (!store.isEditModelOpen) store.setModelConfig(buildMatchedModelConfig(model))
		setSuggestions([])
		setHighlightedIndex(-1)
		setOpen(false)
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const value = e.target.value
		store.setProviderModelId(value)
		if (!store.isEditModelOpen) store.clearModelConfig()

		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			fetchSuggestions(value)
		}, 300)

		setOpen(true)
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const hasSuggestions = suggestions.length > 0
		if (!hasSuggestions) {
			if (e.key === "Escape") setOpen(false)
			return
		}

		if (e.key === "ArrowDown") {
			e.preventDefault()
			if (!open) {
				setOpen(true)
				setHighlightedIndex(0)
				return
			}
			setHighlightedIndex((prev) => (prev + 1) % suggestions.length)
			return
		}

		if (e.key === "ArrowUp") {
			e.preventDefault()
			if (!open) {
				setOpen(true)
				setHighlightedIndex(suggestions.length - 1)
				return
			}
			setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
			return
		}

		if (e.key === "Enter" && open) {
			e.preventDefault()
			const selectedModel = suggestions[highlightedIndex >= 0 ? highlightedIndex : 0]
			if (selectedModel) handleSelect(selectedModel)
			return
		}

		if (e.key === "Escape") {
			e.preventDefault()
			setOpen(false)
		}
	}

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node))
				setOpen(false)
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	useEffect(
		() => () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		},
		[],
	)

	useEffect(() => {
		if (!open || suggestions.length === 0) {
			setHighlightedIndex(-1)
			return
		}
		setHighlightedIndex((prev) => {
			if (prev < 0) return 0
			if (prev >= suggestions.length) return suggestions.length - 1
			return prev
		})
	}, [open, suggestions.length])

	useEffect(() => {
		if (!open || highlightedIndex < 0) return
		optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" })
	}, [open, highlightedIndex])

	const showDropdown = open && (suggestions.length > 0 || isLoading)

	return (
		<div ref={containerRef} className="relative w-full">
			<Input
				className={cn(
					"h-9 text-sm",
					showError && "border-destructive focus-visible:ring-destructive/20",
				)}
				placeholder="e.g., qwen-3.5"
				value={store.providerModelId}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onFocus={() => {
					if (suggestions.length > 0) setOpen(true)
				}}
				onBlur={() => setTouched(true)}
				data-testid="add-model-deployment-name-input"
			/>
			{showError && (
				<p className="mt-1 text-xs text-destructive" role="alert">
					{t("messageEditor.addModel.fieldRequired")}
				</p>
			)}
			{showDropdown && (
				<div
					className={cn(
						"absolute left-0 top-[calc(100%+4px)] z-dropdown w-full",
						"overflow-hidden rounded-md border border-border bg-popover",
						"shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]",
					)}
					role="listbox"
					data-testid="add-model-deployment-suggestions"
				>
					{isLoading && suggestions.length === 0 ? (
						<div
							className="flex items-center justify-center px-2 py-1.5 text-sm text-muted-foreground"
							data-testid="add-model-deployment-suggestions-loading"
						>
							<Spinner size={16} className="animate-spin" />
						</div>
					) : (
						<ScrollArea
							className="h-56 overflow-hidden"
							viewportClassName="p-1 pr-1.5"
							data-testid="add-model-deployment-suggestions-scroll-area"
						>
							{suggestions.map((model, index) => (
								<button
									key={model.id}
									type="button"
									ref={(node) => {
										optionRefs.current[index] = node
									}}
									className={cn(
										"w-full rounded-xs px-2 py-1.5 text-left text-sm leading-5",
										"text-popover-foreground",
										"hover:bg-secondary/80",
										highlightedIndex === index &&
											"bg-secondary text-secondary-foreground",
										"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
									)}
									role="option"
									aria-selected={highlightedIndex === index}
									onMouseEnter={() => setHighlightedIndex(index)}
									onMouseDown={(e) => {
										e.preventDefault()
										handleSelect(model)
									}}
									data-testid={`add-model-suggestion-${model.id}`}
								>
									<span className="block truncate">{model.name}</span>
									<span
										className={cn(
											"block truncate text-xs text-muted-foreground",
											highlightedIndex === index &&
												"text-secondary-foreground/80",
										)}
									>
										{model.id}
									</span>
								</button>
							))}
						</ScrollArea>
					)}
				</div>
			)}
		</div>
	)
})

export default ModelDeploymentField
