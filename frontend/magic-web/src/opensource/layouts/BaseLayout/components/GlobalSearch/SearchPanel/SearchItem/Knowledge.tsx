import type { GlobalSearch } from "@/opensource/types/search"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import { Breadcrumb } from "antd"
import { IconChevronRight } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import HighlightText from "../HighlightText"
import useFileParser from "../hooks/useFileParser"
import { useSearchItemCommonStyles } from "./styles"
import { useMagicSearchStore } from "../../store"
import { history } from "@/opensource/routes"

interface SearchItemKnowledgeProps {
	item: GlobalSearch.KnowledgeItem
}

function Knowledge(props: SearchItemKnowledgeProps) {
	const { item } = props
	const { styles, cx } = useSearchItemCommonStyles()

	const { t } = useTranslation("search")
	const closePanel = useMagicSearchStore((store) => store.closePanel)

	const { getFileUrl, getFileIcon } = useFileParser({ file: item })

	const onClick = useMemoizedFn((event) => {
		event?.stopPropagation()
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
					<Breadcrumb
						className={styles.breadcrumb}
						separator={<IconChevronRight size={20} strokeWidth={1.5} />}
						items={
							item?.path?.map((i) => {
								return {
									title: <HighlightText text={i?.name} />,
								}
							}) ?? []
						}
					/>
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

export default Knowledge
