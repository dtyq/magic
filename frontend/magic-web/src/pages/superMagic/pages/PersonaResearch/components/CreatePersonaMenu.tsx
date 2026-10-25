import type { ReactNode } from "react"
import { ChevronDown, MessagesSquare, Plus, SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"

interface CreatePersonaMenuProps {
	onCreateWithChat: () => void
	onCreateManually: () => void
	align?: "start" | "center" | "end"
}

/** "New persona" button: build with the AI (recommended) or fill in a form. */
export default function CreatePersonaMenu({
	onCreateWithChat,
	onCreateManually,
	align = "end",
}: CreatePersonaMenuProps) {
	const { t } = useTranslation("personaResearch")
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="sm" className="gap-1.5" data-testid="persona-research-create-persona">
					<Plus className="size-4" />
					{t("library.create")}
					<ChevronDown className="size-3.5 opacity-70" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="w-72 p-1.5">
				<MenuOption
					icon={<MessagesSquare className="size-4" />}
					title={t("library.createChat")}
					badge={t("library.recommended")}
					hint={t("library.createChatHint")}
					onSelect={onCreateWithChat}
				/>
				<MenuOption
					icon={<SquarePen className="size-4" />}
					title={t("library.createManual")}
					hint={t("library.createManualHint")}
					onSelect={onCreateManually}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function MenuOption({
	icon,
	title,
	badge,
	hint,
	onSelect,
}: {
	icon: ReactNode
	title: string
	badge?: string
	hint: string
	onSelect: () => void
}) {
	return (
		<DropdownMenuItem className="items-start gap-3 rounded-lg p-2.5" onSelect={onSelect}>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
				{icon}
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="flex items-center gap-1.5 text-[13px] font-medium">
					{title}
					{badge ? (
						<span className="rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground">
							{badge}
						</span>
					) : null}
				</span>
				<span className="text-xs leading-5 text-muted-foreground">{hint}</span>
			</span>
		</DropdownMenuItem>
	)
}
