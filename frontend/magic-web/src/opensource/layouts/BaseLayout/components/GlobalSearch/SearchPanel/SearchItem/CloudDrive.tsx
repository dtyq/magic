import type { GlobalSearch } from "@/opensource/types/search"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"
import { useMagicSearchStore } from "../../store"
import useFileParser from "../hooks/useFileParser"
import { history } from "@/opensource/routes/history"

interface SearchItemCloudDriveProps {
	item: GlobalSearch.CloudDriveItem
}

function CloudDrive(props: SearchItemCloudDriveProps) {
	const { item } = props

	const { t } = useTranslation("search")
	const { styles, cx } = useSearchItemCommonStyles()

	const closePanel = useMagicSearchStore((store) => store.closePanel)

	const { getFileUrl, getFileIcon } = useFileParser({ file: item })

	const onClick = useMemoizedFn(() => {
		const params = getFileUrl()
		if (params) {
			history.push(params)
		}
		closePanel?.()
	})

	const icon = useMemo(() => {
		return getFileIcon()
	}, [getFileIcon])

	return (
		<div className={styles.item} onClick={onClick}>
			<div className={styles.icon}>{icon}</div>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.name} />
				</div>
				{item?.highlights && (
					<div className={cx(styles.desc, styles.text2)}>
						{item?.highlights?.title?.map((i) => (
							<HighlightText text={i} key={i} />
						))}
						{item?.highlights?.content?.map((i) => (
							<HighlightText text={i} key={i} />
						))}
					</div>
				)}
				<div className={cx(styles.desc, styles.text2)}>
					<HighlightText
						text={`${t("quickSearch.label.creator")}: ${item?.creator?.real_name}`}
					/>
				</div>
			</div>
		</div>
	)
}

export default CloudDrive
