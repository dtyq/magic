import { memo, useRef, useState, useEffect } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Search, X } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn-ui/input-group"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import HeaderTrailingAction from "./HeaderTrailingAction"
import { SidebarSectionToggle, type SidebarSectionOptions } from "../../SidebarSection"
import { useFileHeaderOverflow } from "../hooks/useFileHeaderOverflow"

interface SearchModeHeaderProps {
	placeholder?: string
	searchValue: string
	onSearchChange: (value: string) => void
	onSearchCommit?: (value: string) => void
	onClose: () => void
	headerTrailingAction?: ReactNode
	section?: SidebarSectionOptions
	className?: string
}

function SearchModeHeader({
	placeholder,
	searchValue,
	onSearchChange,
	onSearchCommit,
	onClose,
	headerTrailingAction,
	section,
	className,
}: SearchModeHeaderProps) {
	const { t } = useTranslation("super")
	const { rowRef, labelRef, actionsRef } = useFileHeaderOverflow()
	const [localValue, setLocalValue] = useState(searchValue)
	const isComposingRef = useRef(false)

	// 当外部 searchValue 变化时，同步到 localValue
	useEffect(() => {
		setLocalValue(searchValue)
	}, [searchValue])

	const handleCompositionStart = () => {
		isComposingRef.current = true
	}

	const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
		isComposingRef.current = false
		const value = e.currentTarget.value
		setLocalValue(value)
		if (onSearchCommit) {
			onSearchCommit(value)
			return
		}
		onSearchChange(value)
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		setLocalValue(value)

		// 只有在非组合状态下才触发搜索
		if (!isComposingRef.current) {
			onSearchChange(value)
		}
	}

	return (
		<div
			ref={rowRef}
			className={cn("flex h-8 items-center gap-1 px-2", section && "h-10", className)}
		>
			<InputGroup className="h-7 min-w-0 flex-1 rounded-md duration-300 animate-in fade-in slide-in-from-left-4 [&:has([data-slot=input-group-control]:focus-visible)]:border-input [&:has([data-slot=input-group-control]:focus-visible)]:ring-0">
				<span
					ref={labelRef}
					aria-hidden
					className="pointer-events-none invisible absolute whitespace-nowrap text-sm"
				>
					{placeholder ?? t("common.searchFiles")}
				</span>
				<InputGroupAddon align="inline-start">
					<Search size={16} />
				</InputGroupAddon>
				<InputGroupInput
					className="h-6"
					placeholder={placeholder ?? t("common.searchFiles")}
					data-testid="file-search-input"
					value={localValue}
					onChange={handleChange}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
					autoFocus
				/>
			</InputGroup>
			<div ref={actionsRef} className="relative flex shrink-0 items-center gap-1">
				<Button
					type="button"
					size="icon-sm"
					className="size-7 shrink-0 border bg-white text-foreground duration-300 animate-in fade-in hover:bg-accent"
					data-testid="file-search-close-button"
					onClick={onClose}
					aria-label={t("common.cancel")}
				>
					<X size={16} />
				</Button>
				{headerTrailingAction ? (
					<HeaderTrailingAction>{headerTrailingAction}</HeaderTrailingAction>
				) : null}
			</div>
			{section && (
				<SidebarSectionToggle
					label={t("userSpace.memory")}
					isExpanded={section.isExpanded}
					onClick={section.onClick}
				/>
			)}
		</div>
	)
}

export default memo(SearchModeHeader)
