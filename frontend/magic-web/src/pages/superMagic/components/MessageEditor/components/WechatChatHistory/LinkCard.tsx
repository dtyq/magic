import { useState } from "react"
import { Link as LinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getKnownSiteName } from "./siteNames"

export default function LinkCard({ url, title }: { url: string; title: string }) {
	const { t } = useTranslation("super")
	const [failed, setFailed] = useState(false)
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return <span>{title || url}</span>
	}
	const site = getKnownSiteName(parsed.hostname) ?? parsed.hostname
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex min-h-36 w-80 max-w-full flex-col rounded-lg bg-muted p-4 text-foreground no-underline"
		>
			<strong className="line-clamp-2 text-sm font-medium leading-6">
				{title.replace(url, "").trim() || site}
			</strong>
			<span className="mt-2 line-clamp-2 break-all text-xs leading-5 text-muted-foreground">
				{url}
			</span>
			<span className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
				<span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded bg-foreground text-background">
					{!failed && getKnownSiteName(parsed.hostname) ? (
						<img
							src={`${parsed.origin}/favicon.ico`}
							alt=""
							referrerPolicy="no-referrer"
							className="size-5"
							onError={() => setFailed(true)}
						/>
					) : (
						<LinkIcon className="size-4" />
					)}
				</span>
				{site || t("wechatChat.link")}
			</span>
		</a>
	)
}
