import { memo, useRef } from "react"
import { ChevronLeft, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"

interface RecycleBinHeaderProps {
	isSearchOpen: boolean
	searchValue: string
	onBackClick: () => void
	onSearchOpen: () => void
	onSearchCancel: () => void
	onSearchValueChange: (value: string) => void
}

function RecycleBinHeader(props: RecycleBinHeaderProps) {
	const {
		isSearchOpen,
		searchValue,
		onBackClick,
		onSearchOpen,
		onSearchCancel,
		onSearchValueChange,
	} = props

	const { t } = useTranslation("super")
	const searchInputRef = useRef<HTMLInputElement>(null)

	function handleSearchOpen() {
		onSearchOpen()
		requestAnimationFrame(() => searchInputRef.current?.focus())
	}

	return (
		<div
			className="flex h-12 w-full shrink-0 items-center gap-1 bg-background px-2.5"
			data-testid="mobile-recycle-bin-header"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-8 rounded-[10px]"
				onClick={onBackClick}
				aria-label={t("mobile.recycleBin.back")}
				data-testid="mobile-recycle-bin-back-button"
			>
				<ChevronLeft className="size-6 text-foreground" />
			</Button>

			<div className="relative h-8 min-w-0 flex-1">
				<div
					className={cn(
						"absolute inset-0 flex items-center transition-[opacity,transform] duration-200",
						isSearchOpen && "pointer-events-none translate-x-2 opacity-0",
					)}
					data-testid="mobile-recycle-bin-title"
				>
					<div className="min-w-0 flex-1 truncate text-base font-medium leading-6 text-foreground">
						{t("mobile.recycleBin.title")}
					</div>
				</div>

				<div
					className={cn(
						"absolute inset-0 flex items-center gap-2 transition-all duration-200",
						isSearchOpen
							? "translate-x-0 opacity-100"
							: "pointer-events-none -translate-x-2 opacity-0",
					)}
					data-testid="mobile-recycle-bin-search"
				>
					<div
						className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-[#E5E5E5] bg-background px-3 py-1.5"
						data-testid="mobile-recycle-bin-search-input-wrapper"
					>
						<Search className="size-4 shrink-0 text-[#737373]" />
						<input
							ref={searchInputRef}
							value={searchValue}
							onChange={(event) => onSearchValueChange(event.target.value)}
							placeholder={t("mobile.recycleBin.search.placeholder")}
							className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-foreground outline-none placeholder:text-[#737373]"
							data-testid="mobile-recycle-bin-search-input"
						/>
					</div>
					<Button
						type="button"
						variant="outline"
						className="h-8 rounded-full border-[#E5E5E5] px-3 text-sm font-normal leading-5 text-foreground"
						onClick={onSearchCancel}
						data-testid="mobile-recycle-bin-search-cancel"
					>
						{t("mobile.recycleBin.search.cancel")}
					</Button>
				</div>
			</div>

			{!isSearchOpen && (
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 rounded-[10px]"
						onClick={handleSearchOpen}
						aria-label={t("mobile.recycleBin.search.open")}
						data-testid="mobile-recycle-bin-search-open"
					>
						<Search className="size-5 text-foreground" />
					</Button>
				</div>
			)}
		</div>
	)
}

export default memo(RecycleBinHeader)
