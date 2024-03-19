import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { cn } from "@/opensource/lib/utils"
import {
	ALL_LUCIDE_ICON_KEBAB_NAMES,
	LucideLazyIcon,
	toKebabCase,
} from "@/opensource/utils/lucideIconLoader"

/** Convert kebab-case icon name to PascalCase component name */
function toPascalCase(kebab: string): string {
	return kebab
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("")
}

const MAX_DISPLAY = 200

interface IconPickerPanelProps {
	/** Current icon name (PascalCase, e.g. "ChevronRight") */
	value?: string
	onChange: (iconName: string) => void
	children: React.ReactNode
}

/**
 * Searchable icon picker backed by the full lucide-react icon set.
 *
 * Uses PopoverPrimitive.Content WITHOUT Portal so the content renders
 * inside the parent Dialog's DOM subtree. This is required to avoid
 * react-remove-scroll (used by Radix Dialog) blocking wheel events on
 * portal'd elements that live outside the dialog boundary.
 */
export function IconPickerPanel({ value, onChange, children }: IconPickerPanelProps) {
	const { t } = useTranslation("crew/create")
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")

	const currentKebab = value ? toKebabCase(value) : ""

	const filteredIcons = useMemo(() => {
		if (!search.trim()) return ALL_LUCIDE_ICON_KEBAB_NAMES.slice(0, MAX_DISPLAY)
		const q = search.toLowerCase().replace(/\s+/g, "-")
		return ALL_LUCIDE_ICON_KEBAB_NAMES.filter((name) => name.includes(q)).slice(0, MAX_DISPLAY)
	}, [search])

	function handleSelect(kebabName: string) {
		onChange(toPascalCase(kebabName))
		setOpen(false)
		setSearch("")
	}

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen)
		if (!nextOpen) setSearch("")
	}

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
			<PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
			{/* No Portal — renders inside the Dialog DOM so react-remove-scroll allows scroll */}
			<PopoverPrimitive.Content
				align="start"
				sideOffset={4}
				className={cn(
					"z-popup w-80 rounded-md border bg-popover p-0 text-popover-foreground shadow-md",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
					"data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				)}
				data-testid="icon-picker-popover"
			>
				<div className="flex flex-col">
					{/* Search bar */}
					<div className="border-b p-2">
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder={t(
									"playbook.edit.basicInfo.iconPicker.searchPlaceholder",
								)}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="h-9 pl-8"
								autoFocus
								data-testid="icon-picker-search"
							/>
						</div>
					</div>

					{/* Icon grid */}
					{filteredIcons.length > 0 ? (
						<ScrollArea className="h-64">
							<div className="grid grid-cols-8 gap-0.5 p-2">
								{filteredIcons.map((kebabName) => (
									<button
										key={kebabName}
										type="button"
										title={toPascalCase(kebabName)}
										onClick={() => handleSelect(kebabName)}
										className={cn(
											"flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
											currentKebab === kebabName &&
												"bg-accent text-foreground ring-1 ring-primary",
										)}
										data-testid={`icon-picker-item-${kebabName}`}
									>
										<LucideLazyIcon icon={kebabName} size={16} />
									</button>
								))}
							</div>
						</ScrollArea>
					) : (
						<div className="py-8 text-center text-sm text-muted-foreground">
							{t("playbook.edit.basicInfo.iconPicker.noResults")}
						</div>
					)}
				</div>
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Root>
	)
}
