import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import zero from "@/assets/text/403-zero.svg"
import zeroDark from "@/assets/text/403-zero-dark.svg"
import { getHomeURL } from "@/utils/redirect"
import { history } from "@/routes/history"

export default function ForbiddenPage({ className }: { className?: string }) {
	const { t } = useTranslation("interface")

	return (
		<div
			className={cn(
				"flex h-screen w-screen flex-col items-center justify-center gap-10 bg-background",
				className,
			)}
			data-testid="forbidden-page-root"
		>
			<div className="flex items-center justify-center gap-2.5 text-[100px] font-black leading-none text-primary dark:text-[#587DF0]">
				<span>4</span>
				<img src={zero} alt="403" className="block dark:hidden" />
				<img src={zeroDark} alt="403" className="hidden dark:block" />
				<span>3</span>
			</div>
			<div className="flex flex-col items-center gap-5">
				<div className="flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
					<div className="text-[32px] font-medium leading-[44px] text-foreground">
						{t("noAuth.title")}
					</div>
					<div>{t("noAuth.desc")}</div>
				</div>
				<Button
					className="h-8 rounded-md bg-primary px-6 py-1.5 text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
					data-testid="forbidden-back-home-button"
					onClick={() => {
						getHomeURL().then(history.replace)
					}}
				>
					{t("noAuth.return")}
				</Button>
			</div>
		</div>
	)
}
