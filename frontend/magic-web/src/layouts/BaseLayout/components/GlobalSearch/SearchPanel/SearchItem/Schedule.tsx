import { IconSchedule } from "@/enhance/tabler/icons-react"
import type { GlobalSearch } from "@/types/search"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"

interface SearchItemScheduleProps {
	item: GlobalSearch.ScheduleItem
}

function Schedule(props: SearchItemScheduleProps) {
	const { item } = props
	const { styles, cx } = useSearchItemCommonStyles()

	return (
		<div className={styles.item}>
			<div className={styles.icon}>
				<IconSchedule size={20} />
			</div>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.title} />
				</div>
				<div className={cx(styles.desc, styles.text2)}>
					<HighlightText text="优先级：普通" />
				</div>
				<div className={cx(styles.desc, styles.text2)}>
					<HighlightText text={`执行人: ${item?.series_id}`} />
				</div>
				<div className={cx(styles.desc, styles.text2)}>
					<HighlightText text={`Magic 截止时间：${item?.end_time}`} />
				</div>
			</div>
		</div>
	)
}

export default Schedule
