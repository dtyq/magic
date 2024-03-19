import { memo, useRef, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Search, X } from "lucide-react"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/opensource/components/shadcn-ui/input-group"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"

interface SearchModeHeaderProps {
	searchValue: string
	onSearchChange: (value: string) => void
	onClose: () => void
	className?: string
}

function SearchModeHeader({
	searchValue,
	onSearchChange,
	onClose,
	className,
}: SearchModeHeaderProps) {
	const { t } = useTranslation("super")
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
		// 组合结束时，传递最终的值
		onSearchChange(e.currentTarget.value)
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
		<div className={cn("flex h-8 items-center gap-2 px-2", className)}>
			<InputGroup className="h-7 flex-1 rounded-md duration-300 animate-in fade-in slide-in-from-left-4 [&:has([data-slot=input-group-control]:focus-visible)]:border-input [&:has([data-slot=input-group-control]:focus-visible)]:ring-0">
				<InputGroupAddon align="inline-start">
					<Search size={16} />
				</InputGroupAddon>
				<InputGroupInput
					className="h-6"
					placeholder={t("common.searchFiles")}
					value={localValue}
					onChange={handleChange}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
					autoFocus
				/>
			</InputGroup>
			<Button
				type="button"
				size="icon-sm"
				className="size-7 border bg-white text-foreground duration-300 animate-in fade-in hover:bg-accent"
				onClick={onClose}
				aria-label={t("common.cancel")}
			>
				<X size={16} />
			</Button>
		</div>
	)
}

export default memo(SearchModeHeader)
