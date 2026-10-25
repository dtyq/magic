import { useEffect, useId, useState, type RefObject } from "react"
import { CircleCheck, ListCollapse } from "lucide-react"
import { Arrow } from "@radix-ui/react-popover"
import { useTranslation } from "react-i18next"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/shadcn-ui/popover"
import { Switch } from "@/components/shadcn-ui/switch"
import { Button } from "@/components/shadcn-ui/button"
import { useMessageDisplayPreference } from "../../../services/messageDisplayPreference"

/** 锚定三个点图标；引导和菜单共享偏好，领取提示时就记为已展示。 */
export function SimpleModeGuide({
	anchorRef,
	available = true,
	menuOpen = false,
}: {
	anchorRef: RefObject<HTMLElement>
	available?: boolean
	menuOpen?: boolean
}) {
	const { t } = useTranslation("super")
	const id = useId()
	const preference = useMessageDisplayPreference(available)
	const [guideAccount, setGuideAccount] = useState<string | null>(null)
	useEffect(() => {
		if (menuOpen) {
			setGuideAccount(null)
			return
		}
		if (preference.claimGuide()) setGuideAccount(preference.accountKey)
	}, [menuOpen, preference.accountKey, preference.claimGuide])
	const open = preference.available && !menuOpen && guideAccount === preference.accountKey
	return (
		<Popover
			open={open}
			onOpenChange={(value) => {
				if (!value) setGuideAccount(null)
			}}
		>
			<PopoverAnchor virtualRef={anchorRef} />
			<PopoverContent
				side="bottom"
				align="end"
				alignOffset={-8}
				sideOffset={3}
				collisionPadding={16}
				className="w-[260px] max-w-[calc(100vw-32px)] rounded-lg p-3 font-normal shadow-[0_3px_12px_rgb(var(--foreground-rgb)/0.05)]"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<div className="flex items-center justify-between gap-3">
					<label
						htmlFor={id}
						className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold leading-5"
					>
						<ListCollapse size={16} className="shrink-0" />
						{t("simpleMode.guideTitle")}
					</label>
					<Switch
						id={id}
						checked={preference.simpleMode}
						onCheckedChange={preference.setSimpleMode}
					/>
				</div>
				<p className="my-1.5 text-xs leading-relaxed text-muted-foreground">
					{t("simpleMode.description")}
					<br />
					{t("simpleMode.guideHelp")}
				</p>
				<div className="flex items-center justify-between gap-3">
					{preference.simpleMode ? (
						<span
							role="status"
							className="inline-flex items-center gap-1 text-xs text-success"
						>
							<CircleCheck size={14} />
							{t("simpleMode.enabled")}
						</span>
					) : (
						<Button
							type="button"
							size="sm"
							className="h-7 px-2.5 text-xs"
							onClick={() => preference.setSimpleMode(true)}
						>
							{t("simpleMode.enable")}
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2.5 text-xs"
						onClick={() => setGuideAccount(null)}
					>
						{t("simpleMode.dismiss")}
					</Button>
				</div>
				<Arrow width={16} height={8} asChild>
					<svg width="16" height="8" viewBox="0 0 16 8" className="fill-popover">
						<path
							d="M0 0 L8 8 L16 0"
							stroke="rgb(var(--foreground-rgb) / 0.18)"
							strokeWidth="1"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				</Arrow>
			</PopoverContent>
		</Popover>
	)
}
