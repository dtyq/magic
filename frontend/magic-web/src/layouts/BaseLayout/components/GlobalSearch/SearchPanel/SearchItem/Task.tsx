import { IconLayoutKanbanFilled } from "@tabler/icons-react"
import type { GlobalSearch } from "@/types/search"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMagicSearchStore } from "../../store"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"

interface SearchItemTaskProps {
	item: GlobalSearch.TaskItem
}

const useStyles = createStyles(({ token }) => {
	return {
		flex: {
			gap: "4px",
			display: "flex",
		},
		tag: {
			display: "inline-flex",
			padding: 4,
			height: 20,
			justifyContent: "center",
			alignItems: "center",
			gap: 10,
			borderRadius: 4,
			fontSize: 10,
			fontWeight: 400,
		},
		grey: {
			backgroundColor: token.magicColorUsages.fill[0],
			color: token.magicColorScales.grey[5],
		},
		blue: {
			backgroundColor: token.magicColorScales.brand[0],
			color: token.magicColorScales.brand[5],
		},
		green: {
			backgroundColor: token.magicColorScales.green[0],
			color: token.magicColorScales.green[7],
		},
		icon: {
			backgroundColor: "rgba(0, 191, 154, 1)",
		},
	}
})

function Task(props: SearchItemTaskProps) {
	const { item } = props

	const { t } = useTranslation("search")
	const { styles: taskStyles } = useStyles()
	const { styles, cx } = useSearchItemCommonStyles()
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
					<div
						className={cx(styles.desc, styles.text2)}
						style={{ height: "auto", display: "flex" }}
					>
						{t("quickSearch.label.executor")}：
						<span style={{ whiteSpace: "break-spaces" }}>
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
