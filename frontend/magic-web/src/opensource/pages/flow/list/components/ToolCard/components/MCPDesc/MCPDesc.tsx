import { Flow } from "@/types/flow"
import useStyles from "./style"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"

export default function MCPDesc({ item }: { item: Flow.Mcp.Detail }) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation()

	const isLatest = useMemo(() => {
		if (!item.version || !item?.source_version?.latest_version_name) {
			return true
		}
		return item.version === item?.source_version?.latest_version_name
	}, [item])

	if (isLatest) {
		return null
	}

	return (
		<>
			<div className={styles.version}>
				{t("mcp.currentVersion", {
					ns: "flow",
					version: item.version,
				})}
			</div>
			<div className={cx(styles.version, styles.latestVersion)}>
				{t("mcp.latestVersion", {
					ns: "flow",
					version: item?.source_version?.latest_version_name,
				})}
			</div>
		</>
	)
}
