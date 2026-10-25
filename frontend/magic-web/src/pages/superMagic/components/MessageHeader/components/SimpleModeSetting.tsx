import { DropdownMenuItem } from "@/components/shadcn-ui/dropdown-menu"
import { useId } from "react"
import { ListCollapse } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Switch } from "@/components/shadcn-ui/switch"
import { useMessageDisplayPreference } from "../../../services/messageDisplayPreference"

export function SimpleModeSetting({
	available = true,
	inMenu = false,
}: {
	available?: boolean
	inMenu?: boolean
}) {
	const { t } = useTranslation("super")
	const id = useId()
	const preference = useMessageDisplayPreference(available)
	if (!preference.available) return null
	if (inMenu)
		return (
			<DropdownMenuItem
				role="menuitemcheckbox"
				aria-checked={preference.simpleMode}
				onSelect={(event) => {
					event.preventDefault()
					preference.setSimpleMode(!preference.simpleMode)
				}}
				className="items-start py-2.5"
			>
				<ListCollapse size={16} className="mt-0.5 text-muted-foreground" />
				<div className="flex-1">
					<span className="text-[13px] leading-5">{t("simpleMode.title")}</span>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{t("simpleMode.description")}
					</p>
				</div>
				<span aria-hidden className="pointer-events-none mt-0.5">
					<Switch tabIndex={-1} checked={preference.simpleMode} />
				</span>
			</DropdownMenuItem>
		)
	return (
		<div className="px-2 py-2.5">
			<div className="flex items-center justify-between gap-3">
				<label
					htmlFor={id}
					className="flex cursor-pointer items-center gap-2 text-[13px] leading-5"
				>
					<ListCollapse size={16} className="shrink-0 text-muted-foreground" />
					{t("simpleMode.title")}
				</label>
				<Switch
					id={id}
					checked={preference.simpleMode}
					onCheckedChange={preference.setSimpleMode}
				/>
			</div>
			<p className="mt-1.5 text-xs leading-5 text-muted-foreground">
				{t("simpleMode.description")}
			</p>
		</div>
	)
}
