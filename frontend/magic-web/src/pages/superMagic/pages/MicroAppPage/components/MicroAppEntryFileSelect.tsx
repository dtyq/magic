import { useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import {
	Command,
	CommandInput,
	CommandList,
	CommandItem,
	CommandEmpty,
	CommandGroup,
} from "@/components/shadcn-ui/command"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { cn } from "@/utils/cn"
import { collectHtmlFiles, getAttachmentId, getMicroAppPreviewPath } from "../utils/microAppFiles"

interface Props {
	attachmentList: AttachmentItem[]
	value: string | null
	onChange: (value: string | null) => void
	disabled?: boolean
	mobile?: boolean
}

export default function MicroAppEntryFileSelect({
	attachmentList,
	value,
	onChange,
	disabled,
	mobile,
}: Props) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
	const files = useMemo(
		() =>
			collectHtmlFiles(attachmentList).map((file) => ({
				id: String(getAttachmentId(file)),
				label: getMicroAppPreviewPath(file).replace(/^\//, ""),
			})),
		[attachmentList],
	)
	const options = [{ id: null, label: t("microAppPage.publish.defaultOpenFileAuto") }, ...files]
	const trigger = (
		<Button
			ref={triggerRef}
			id="micro-app-default-open-file"
			data-testid="micro-app-default-open-file"
			variant="outline"
			role={mobile ? "button" : "combobox"}
			aria-haspopup="dialog"
			onClick={mobile ? () => setOpen(true) : undefined}
			aria-expanded={open}
			disabled={disabled}
			className={cn(
				"w-full justify-between bg-background font-normal",
				mobile ? "h-11" : "mt-2 h-9",
			)}
		>
			<span className="truncate">
				{options.find((option) => option.id === value)?.label ??
					t("microAppPage.publish.defaultOpenFileAuto")}
			</span>
			<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
		</Button>
	)
	const menu = (
		<Command
			filter={(_value, search, keywords) =>
				(keywords?.join(" ") ?? "").toLowerCase().includes(search.trim().toLowerCase())
					? 1
					: 0
			}
		>
			<CommandInput
				placeholder={t("microAppPage.publish.defaultOpenFileSearch")}
				aria-label={t("microAppPage.publish.defaultOpenFileSearch")}
			/>
			{/* The shared viewport owns scrolling; keep the search field visible. */}
			<CommandList className="max-h-none overflow-hidden">
				<ScrollArea viewportClassName={mobile ? "max-h-[50dvh]" : "max-h-60"}>
					<CommandEmpty>{t("microAppPage.publish.defaultOpenFileEmpty")}</CommandEmpty>
					<CommandGroup>
						{options.map((option) => (
							<CommandItem
								className={mobile ? "min-h-11 px-4 py-3" : undefined}
								key={option.id ?? "auto"}
								value={option.id ?? "auto"}
								keywords={[option.label]}
								onSelect={() => {
									onChange(option.id)
									setOpen(false)
								}}
							>
								<span className="min-w-0 flex-1 break-all">{option.label}</span>
								<Check
									className={cn(
										"size-4 shrink-0",
										option.id !== value && "invisible",
									)}
								/>
							</CommandItem>
						))}
					</CommandGroup>
				</ScrollArea>
			</CommandList>
		</Command>
	)
	if (mobile)
		return (
			<>
				{trigger}
				<MagicPopup
					visible={open}
					onClose={() => setOpen(false)}
					title={t("microAppPage.publish.defaultOpenFile")}
					headerVariant="actionHeader"
					headerTitle={t("microAppPage.publish.defaultOpenFile")}
					headerLeadingAction={{
						icon: <X />,
						ariaLabel: t("common.cancel"),
						onClick: () => setOpen(false),
					}}
					bodyClassName="overflow-hidden p-0"
				>
					{menu}
				</MagicPopup>
			</>
		)

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				// Keep the menu inside its desktop dialog or mobile drawer stacking and focus boundary.
				if (nextOpen)
					setPortalContainer(
						triggerRef.current?.closest<HTMLElement>(
							'[data-slot="drawer-content"], [role="dialog"]',
						) ?? null,
					)
				setOpen(nextOpen)
			}}
		>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				container={portalContainer}
				align="start"
				className="w-[var(--radix-popover-trigger-width)] p-0"
			>
				{menu}
			</PopoverContent>
		</Popover>
	)
}
