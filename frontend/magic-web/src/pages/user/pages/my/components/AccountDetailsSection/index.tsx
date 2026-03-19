import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import PointsSummaryEntry from "./PointsSummaryEntry"

function AccountDetailsSection() {
	const { t } = useTranslation("interface")

	return (
		<div className="flex w-full flex-col items-start gap-2">
			{/* 标题 */}
			<div className="flex w-full items-center justify-center px-1 py-0">
				<div className="flex-1 text-xs font-normal leading-4 text-foreground">
					{t("setting.accountDetails")}
				</div>
			</div>

			{/* 按钮组 */}
			<div className="flex w-full flex-col items-start overflow-hidden rounded-xl bg-fill">
				<PointsSummaryEntry />
			</div>
		</div>
	)
}

export default observer(AccountDetailsSection)
