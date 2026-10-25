import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Bug, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	getCurrentProjectDebugState,
	isSuperMagicDebugEnabled,
} from "../services/debugProjectState"

function formatLocalTimestamp(date = new Date()) {
	const pad = (value: number) => String(value).padStart(2, "0")
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
		date.getHours(),
	)}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

export default function SuperMagicDebugMenu() {
	const { t } = useTranslation("super")
	const [loading, setLoading] = useState(false)
	if (!isSuperMagicDebugEnabled()) return null

	const handleDownload = async () => {
		if (loading) return
		setLoading(true)
		try {
			const content = await getCurrentProjectDebugState()
			const blob = new Blob([content], { type: "application/json;charset=utf-8" })
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = url
			link.download = `super-magic-debug-${formatLocalTimestamp()}.json`
			link.click()
			URL.revokeObjectURL(url)
		} catch (error) {
			console.error("Failed to download Super Magic debug state", error)
			magicToast.error(t("debug.downloadFailed"))
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="fixed bottom-5 right-20 z-[100]">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						className="size-10 rounded-full shadow-md"
						variant="outline"
						size="icon"
					>
						<Bug className="size-5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" sideOffset={8} className="w-64">
					<DropdownMenuLabel>{t("debug.title")}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={(event) => {
							event.preventDefault()
							void handleDownload()
						}}
						disabled={loading}
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Download className="size-4" />
						)}
						{t("debug.downloadProjectState")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
