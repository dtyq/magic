import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SearchApprovalStatus, SearchMessageDate } from "../types"

export function useApprovalOptions() {
	const { t } = useTranslation("search")

	const statusOptions = useMemo(() => {
		return [
			{ text: t("quickSearch.settings.approve.all"), value: SearchApprovalStatus.All },
			{
				text: t("quickSearch.settings.approve.underApproval"),
				value: SearchApprovalStatus.UnderApproval,
			},
			{
				text: t("searchPanel.settings.approve.approved"),
				value: SearchApprovalStatus.Approved,
			},
			{
				text: t("quickSearch.settings.approve.rejected"),
				value: SearchApprovalStatus.Rejected,
			},
			// {
			// 	text: t("quickSearch.settings.approve.disallow"),
			// 	value: SearchApprovalStatus.Disallow,
			// },
			{
				text: t("quickSearch.settings.approve.revoked"),
				value: SearchApprovalStatus.Revoked,
			},
		]
	}, [t])

	const timeOptions = useMemo(() => {
		return [
			{
				text: t("quickSearch.settings.time.unrestrictedTime"),
				value: SearchMessageDate.UnrestrictedTime,
			},
			{ text: t("quickSearch.settings.time.today"), value: SearchMessageDate.Today },
			{
				text: t("quickSearch.settings.time.almostAWeek"),
				value: SearchMessageDate.AlmostAWeek,
			},
			{
				text: t("quickSearch.settings.time.almostAMonth"),
				value: SearchMessageDate.AlmostAMonth,
			},
		]
	}, [t])

	return { statusOptions, timeOptions }
}
