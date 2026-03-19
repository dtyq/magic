import type React from "react"
import { Button } from "@/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import NotFoundImage from "@/pages/exception/not-found/NotFoundImage"
import { getHomeURL } from "@/utils/redirect"
import { history } from "@/routes/history"

const NotFound: React.FC = () => {
	const { t } = useTranslation("interface")

	const handleBackHome = () => {
		getHomeURL().then(history.replace)
	}

	return (
		<div
			className="flex h-screen flex-col items-center justify-center gap-10"
			data-testid="not-found-page-root"
		>
			<NotFoundImage />
			<div className="flex flex-col items-center justify-center">
				<div className="text-center text-[32px] font-semibold leading-[44px] text-muted-foreground">
					{t("pageNotFound")}
				</div>
				<div className="text-center text-sm leading-5 text-muted-foreground">
					{t("pageNotFoundTip")}
				</div>
				<Button
					className="mt-5"
					data-testid="not-found-back-home-button"
					onClick={handleBackHome}
				>
					{t("backHome")}
				</Button>
			</div>
		</div>
	)
}

export default NotFound
