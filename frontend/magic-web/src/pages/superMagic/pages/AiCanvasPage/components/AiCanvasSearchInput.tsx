import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Search, X } from "lucide-react"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"

interface AiCanvasSearchInputProps {
	value: string
	onChange: (value: string) => void
	/** Width override; the desktop header keeps a fixed width, H5 spans the row. */
	className?: string
}

/** Name search of "My canvases": a pill input with a clear button once something is typed. */
function AiCanvasSearchInput({ value, onChange, className }: AiCanvasSearchInputProps) {
	const { t } = useTranslation("aiCanvas")
	const placeholder = t("home.searchPlaceholder")

	return (
		<div className={cn("relative w-56 shrink-0", className)}>
			<Search
				size={16}
				className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape" && value) {
						event.preventDefault()
						onChange("")
					}
				}}
				placeholder={placeholder}
				aria-label={placeholder}
				// Hide the native search clear control; the custom one below matches the design.
				className="h-9 rounded-full pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
				data-testid="ai-canvas-search-input"
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={t("home.searchClear")}
					title={t("home.searchClear")}
				>
					<X size={14} />
				</button>
			) : null}
		</div>
	)
}

export default memo(AiCanvasSearchInput)
