import type {
	AssetTagMutationResponse,
	AssetTagTreeNode,
	CreateAssetTagParams,
	UpdateAssetTagParams,
} from "@/apis"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/shadcn-ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { cn } from "@/utils/cn"
import { ChevronsUpDown, Settings2, X } from "lucide-react"
import { useMemo, useState } from "react"
import AssetTagManager from "./AssetTagManager"
import { partitionAssetTagOptions, type AssetTagOption } from "./assetTagTree"

interface AssetTagMultiSelectLabels {
	manage: string
	title: string
	createTag: string
	customGroup: string
	tagPlaceholder: string
	edit: string
	delete: string
	deleting: string
	cancelEdit: string
	cancelCreate: string
	empty: string
	selected: string
	selectedCount: string
	clear: string
	duplicate: string
}

interface AssetTagMultiSelectProps {
	groups: AssetTagTreeNode[]
	value: string[]
	onChange: (value: string[]) => void
	label: string
	placeholder: string
	searchPlaceholder: string
	emptyText: string
	removeLabel: string
	labels: AssetTagMultiSelectLabels
	onCreateTag: (params: CreateAssetTagParams) => Promise<AssetTagMutationResponse>
	onUpdateTag: (tagId: string, params: UpdateAssetTagParams) => Promise<AssetTagMutationResponse>
	onDeleteTag: (tagId: string) => Promise<AssetTagMutationResponse>
	onMutationError?: (error: unknown) => void
	onManagerOpenChange?: (open: boolean) => void
}

export default function AssetTagMultiSelect({
	groups,
	value,
	onChange,
	label,
	placeholder,
	searchPlaceholder,
	emptyText,
	removeLabel,
	labels,
	onCreateTag,
	onUpdateTag,
	onDeleteTag,
	onMutationError,
	onManagerOpenChange,
}: AssetTagMultiSelectProps) {
	const [open, setOpen] = useState(false)
	const [managerOpen, setManagerOpen] = useState(false)
	const { groupedOptions, customOptions } = useMemo(
		() => partitionAssetTagOptions(groups),
		[groups],
	)
	const selectedOptions = useMemo(() => {
		const optionById = new Map<string, AssetTagOption>()
		for (const { options } of groupedOptions) {
			for (const option of options) optionById.set(option.id, option)
		}
		for (const option of customOptions) optionById.set(option.id, option)
		return value.flatMap((id) => {
			const option = optionById.get(id)
			return option ? [option] : []
		})
	}, [customOptions, groupedOptions, value])

	const toggleOption = (optionId: string) => {
		onChange(
			value.includes(optionId)
				? value.filter((selectedId) => selectedId !== optionId)
				: [...value, optionId],
		)
	}

	const handleManagerOpenChange = (nextOpen: boolean) => {
		setManagerOpen(nextOpen)
		onManagerOpenChange?.(nextOpen)
	}

	const handleDeleteTag = async (tagId: string) => {
		const response = await onDeleteTag(tagId)
		// The delete endpoint also removes asset associations. Keep the form payload
		// in sync so a tag deleted from the manager cannot be submitted again.
		if (value.includes(tagId)) {
			onChange(value.filter((selectedId) => selectedId !== tagId))
		}
		return response
	}

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<div
						role="combobox"
						tabIndex={0}
						aria-label={label}
						aria-expanded={open}
						aria-haspopup="listbox"
						className={cn(
							"flex min-h-10 w-full cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow]",
							"focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
						)}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setOpen((current) => !current)
							}
						}}
					>
						<div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
							{selectedOptions.length > 0 ? (
								selectedOptions.map((option) => (
									<Badge
										key={option.id}
										variant="secondary"
										className="max-w-full rounded-md pr-1"
									>
										<span className="truncate">{option.name}</span>
										<button
											type="button"
											className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											aria-label={`${removeLabel}: ${option.name}`}
											onKeyDown={(event) => event.stopPropagation()}
											onClick={(event) => {
												event.stopPropagation()
												toggleOption(option.id)
											}}
										>
											<X className="size-3" aria-hidden="true" />
										</button>
									</Badge>
								))
							) : (
								<span className="py-0.5 text-muted-foreground">{placeholder}</span>
							)}
						</div>
						<ChevronsUpDown
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
					</div>
				</PopoverTrigger>
				{/* Popover portals to body, so it must sit one layer above the z-modal dialog.
			    The parent dialog's scroll lock preventDefault's wheel events that bubble
			    to document from this portal. Stopping them here keeps the list scrollable. */}
				<PopoverContent
					align="start"
					className="z-[1001] flex max-h-[var(--radix-popover-content-available-height)] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden p-0"
					onOpenAutoFocus={(event) => event.preventDefault()}
					onWheel={(event) => event.stopPropagation()}
				>
					<Command className="min-h-0">
						<CommandInput
							placeholder={searchPlaceholder}
							suffix={
								value.length > 0 ? (
									<>
										<span
											className="whitespace-nowrap text-xs text-muted-foreground"
											aria-live="polite"
										>
											{labels.selectedCount}
										</span>
										<Button
											type="button"
											variant="link"
											className="h-auto p-0 text-xs font-normal no-underline hover:no-underline"
											onClick={() => onChange([])}
										>
											{labels.clear}
										</Button>
									</>
								) : null
							}
						/>
						<CommandList
							aria-multiselectable="true"
							className="max-h-[min(300px,var(--radix-popover-content-available-height))]"
						>
							<CommandEmpty>{emptyText}</CommandEmpty>
							{groupedOptions.map(({ group, options }) => (
								<CommandGroup
									key={group.id}
									heading={group.name}
									className={tagOptionGroupClassName}
								>
									{options.map((option) => (
										<TagOption
											key={option.id}
											option={option}
											checked={value.includes(option.id)}
											onToggle={toggleOption}
										/>
									))}
								</CommandGroup>
							))}
							{customOptions.length > 0 ? (
								<CommandGroup
									heading={labels.customGroup}
									className={tagOptionGroupClassName}
									data-testid="asset-tag-custom-group"
								>
									{customOptions.map((option) => (
										<TagOption
											key={option.id}
											option={option}
											checked={value.includes(option.id)}
											onToggle={toggleOption}
										/>
									))}
								</CommandGroup>
							) : null}
						</CommandList>
					</Command>
					<div className="border-t p-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-full justify-start gap-1.5"
							onClick={() => {
								setOpen(false)
								handleManagerOpenChange(true)
							}}
						>
							<Settings2 className="size-3.5" aria-hidden="true" />
							{labels.manage}
						</Button>
					</div>
				</PopoverContent>
			</Popover>
			<AssetTagManager
				open={managerOpen}
				onOpenChange={handleManagerOpenChange}
				groups={groups}
				selectedIds={value}
				onCreate={onCreateTag}
				onUpdate={onUpdateTag}
				onDelete={handleDeleteTag}
				onMutationError={onMutationError}
				labels={labels}
			/>
		</>
	)
}

// Heading text is inset by px-2. The chip row uses the same inset so button edges line up with the group name.
const tagOptionGroupClassName =
	"[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-wrap [&_[cmdk-group-items]]:gap-1 [&_[cmdk-group-items]]:px-2"

function TagOption({
	option,
	checked,
	onToggle,
}: {
	option: AssetTagOption
	checked: boolean
	onToggle: (optionId: string) => void
}) {
	return (
		<CommandItem
			value={option.groupName ? `${option.name} ${option.groupName}` : option.name}
			aria-pressed={checked}
			data-testid="asset-tag-option"
			onSelect={() => onToggle(option.id)}
			className={cn(
				"h-6 w-auto max-w-full shrink-0 grow-0 cursor-pointer justify-center rounded-md border px-2 py-0 text-xs font-normal leading-4 shadow-none",
				// Color-only active state. A heavier font changes the chip width and shifts the rest of the row.
				checked
					? "border-primary bg-primary/10 text-primary aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary data-[selected=true]:aria-pressed:border-primary data-[selected=true]:aria-pressed:bg-primary/10 data-[selected=true]:aria-pressed:text-primary"
					: "border-border bg-background text-foreground",
			)}
		>
			<span className="truncate">{option.name}</span>
		</CommandItem>
	)
}
