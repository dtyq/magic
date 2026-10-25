import { IconLayoutKanbanFilled } from "@tabler/icons-react"
import type { GlobalSearch } from "@/types/search"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMagicSearchStore } from "../../store"
import { searchItemClassNames as styles } from "./classNames"
import { cn as cx } from "@/utils/cn"
import HighlightText from "../HighlightText"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"

interface SearchItemTaskProps {
	item: GlobalSearch.TaskItem
}

const taskStyles = {
	flex: "flex gap-1",
	tag: "inline-flex h-5 items-center justify-center gap-2.5 rounded p-1 text-[10px] font-normal",
	grey: "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400",
	blue: "bg-neutral-50 text-primary dark:bg-black",
	green: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200",
	icon: "bg-[#00bf9a]",
}

function Task(props: SearchItemTaskProps) {
	const { item } = props

	const { t } = useTranslation("search")
	const closePanel = useMagicSearchStore((store) => store.closePanel)

	const onClick = useMemoizedFn(() => {
		history.push({
			name: RouteName.TaskDetails,
			params: { taskId: item.id },
			query: { taskId: item.id },
		})
		closePanel?.()
	})

	const taskStatus = useMemo(() => {
		const statusText = {
			1: t("quickSearch.label.inProgress"),
			2: t("quickSearch.label.inProgress"),
			3: t("quickSearch.label.completed"),
			4: t("quickSearch.label.inProgress"),
			5: t("quickSearch.label.inProgress"),
		}
		return statusText?.[item?.status] ?? ""
	}, [t, item?.status])

	const priorityStatus = useMemo(() => {
		const priorityText = {
			1: t("quickSearch.label.lower"),
			2: t("quickSearch.label.ordinary"),
			3: t("quickSearch.label.urgent"),
			4: t("quickSearch.label.veryUrgent"),
		}
		return priorityText?.[item.priority] ?? ""
	}, [t, item.priority])

	const items = item?.assignees?.reduce<Array<string>>((array, user) => {
		if (user?.name) {
			array.push(user.name)
		}
		return array
	}, [])

	return (
		<div className={styles.item} onClick={onClick}>
			<div className={cx(styles.icon, taskStyles.icon)}>
				<IconLayoutKanbanFilled size={20} />
			</div>
			<div className={styles.wrapper}>
				<div className={cx(styles.title, taskStyles.flex)}>
					<span
						className={cx(taskStyles.tag, {
							[taskStyles.grey]: false,
							[taskStyles.blue]: item?.status !== 3,
							[taskStyles.green]: item?.status === 3,
						})}
					>
						{taskStatus}
					</span>
					<HighlightText text={item?.title} />
				</div>
				{item?.description && (
					<div className={cx(styles.desc, styles.text2)}>
						<HighlightText text={item?.description ?? ""} />
					</div>
				)}
				<div className={cx(styles.desc, styles.text2)}>
					<HighlightText text={`${t("quickSearch.label.priority")}：${priorityStatus}`} />
				</div>
				{item?.creator?.nickname && (
					<div className={cx(styles.desc, styles.text2)}>
						{t("quickSearch.label.creator")}：
						<HighlightText text={item?.creator?.nickname} />
					</div>
				)}
				{item?.assignees?.length > 0 && (
					<div className={cx(styles.desc, styles.text2, "flex h-auto")}>
						{t("quickSearch.label.executor")}：
						<span className="whitespace-break-spaces">
							<HighlightText text={items?.join(",")} />
						</span>
					</div>
				)}
				<div className={cx(styles.desc, styles.text2)}>
					<HighlightText
						text={`${t("quickSearch.label.deadline")}: ${item?.deadline_time}`}
					/>
				</div>
			</div>
		</div>
	)
}

export default Task
