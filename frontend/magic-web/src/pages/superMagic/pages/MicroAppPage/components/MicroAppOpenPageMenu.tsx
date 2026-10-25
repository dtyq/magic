import { useState, type Ref } from "react"
import { Trigger as DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/shadcn-ui/dropdown-menu"
import type { MicroAppPreviewBrowser } from "../hooks/useMicroAppPreviewFiles"

/** The file picker belongs to the editor; published viewers can only navigate from app content. */
export default function MicroAppOpenPageMenu({
	browser,
	triggerRef,
}: {
	browser: MicroAppPreviewBrowser
	triggerRef?: Ref<HTMLButtonElement>
}) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<MagicTooltip title={t("microAppPage.previewToolbar.openPage")} disabled={open}>
				<DropdownMenuTrigger asChild>
					<Button
						ref={triggerRef}
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 shrink-0"
						disabled={!browser.previewFileOptions.length}
						aria-label={t("microAppPage.previewToolbar.openPage")}
					>
						<Plus size={16} />
					</Button>
				</DropdownMenuTrigger>
			</MagicTooltip>
			<DropdownMenuContent align="start" className="max-h-none max-w-[min(28rem,90vw)]">
				<ScrollArea viewportClassName="max-h-64">
					{browser.previewFileOptions.map((file) => (
						<DropdownMenuItem
							key={file.id}
							onSelect={() => browser.handlePreviewAddFile(file.id)}
						>
							{file.path}
						</DropdownMenuItem>
					))}
				</ScrollArea>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
