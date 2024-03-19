import { memo, useState } from "react"
import { WandSparkles, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/opensource/components/shadcn-ui/badge"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"

interface SearchBarProps {
	onSearch?: (query: string) => void
	onChange?: (value: string) => void
	value?: string
	placeholder?: string
	"data-testid"?: string
}

function SearchBar({
	onSearch,
	onChange,
	value,
	placeholder,
	"data-testid": dataTestId,
}: SearchBarProps) {
	const { t } = useTranslation("crew/market")
	const isControlled = value !== undefined
	const [internalQuery, setInternalQuery] = useState("")
	const query = isControlled ? value : internalQuery

	function handleChange(val: string) {
		if (!isControlled) setInternalQuery(val)
		onChange?.(val)
	}

	function handleSearch() {
		onSearch?.(query)
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") handleSearch()
	}

	return (
		<div
			className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-background p-2.5 shadow-xs"
			data-testid={dataTestId ?? "crew-market-search-bar"}
		>
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<Badge
					variant="outline"
					className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5"
					data-testid="search-bar-ai-badge"
				>
					<WandSparkles className="h-4 w-4 shrink-0" />
					<span className="text-xs font-semibold">{t("aiSearch")}</span>
				</Badge>
				<Input
					value={query}
					onChange={(e) => handleChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder ?? t("aiSearchPlaceholder")}
					className="min-w-0 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
					data-testid="search-bar-input"
				/>
			</div>
			<Button
				size="icon"
				className="h-9 w-9 shrink-0 opacity-50"
				onClick={handleSearch}
				data-testid="search-bar-submit"
				disabled
			>
				<Search className="h-4 w-4" />
			</Button>
		</div>
	)
}

export default memo(SearchBar)
