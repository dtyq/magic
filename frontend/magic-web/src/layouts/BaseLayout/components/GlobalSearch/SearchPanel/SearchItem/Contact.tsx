import { IconIdBadge, IconId } from "@tabler/icons-react"
import type { GlobalSearch } from "@/types/search"
import { useChatWithMember } from "@/hooks/chat/useChatWithMember"
import { useMemoizedFn } from "ahooks"
import { last } from "lodash-es"
import type { MouseEventHandler } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import MemberCardStore from "@/stores/display/MemberCardStore"
import { useMagicSearchStore } from "../../store"
import HighlightText from "../HighlightText"
import { searchItemClassNames as styles } from "./classNames"
import { cn as cx } from "@/utils/cn"

const contactStyles = {
	item: "relative",
	post: "flex items-center gap-0.5 text-xs font-normal leading-4 text-foreground/60",
	organization: "text-[10px] font-normal not-italic leading-3 text-foreground/40",
	wrapper: "absolute right-0 top-2 flex gap-0",
	button: "flex size-9 cursor-pointer items-center justify-center rounded",
	card: "text-[#315cec]",
}

interface SearchItemContactProps {
	item: GlobalSearch.ContactItem
}

function Contact(props: SearchItemContactProps) {
	const { item } = props

	const { t } = useTranslation("search")

	const chatWith = useChatWithMember()
	const closePanel = useMagicSearchStore((store) => store.closePanel)

	const onClick = useMemoizedFn((event) => {
		event?.stopPropagation()
		chatWith?.(item?.user_id)
		closePanel?.()
	})

	const departmentList = useMemo(() => {
		return (
			item?.path_nodes?.map((node) => {
				return node?.department_name
			}) ?? []
		).join(" / ")
	}, [item.path_nodes])

	const jobTitle = item?.job_title
	const departmentName = last(item?.path_nodes)?.department_name ?? ""

	const onMouseEnter = useMemoizedFn<MouseEventHandler<HTMLDivElement>>((e) => {
		MemberCardStore.openCard(item?.user_id, {
			x: e.clientX,
			y: e.clientY,
		})
	})

	const onMouseLeave = useMemoizedFn<MouseEventHandler<HTMLDivElement>>(() => {
		MemberCardStore.closeCard()
	})

	return (
		<div className={cx(styles.item, contactStyles.item)} onClick={onClick}>
			<div
				className={cx(styles.icon, MemberCardStore.domClassName)}
				data-user-id={item?.user_id}
				style={{ backgroundImage: `url(${item?.avatar_url})` }}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.nickname} />
				</div>
				{jobTitle && (
					<div className={contactStyles.post}>
						<IconIdBadge size={12} />
						<span>
							<HighlightText text={jobTitle} />
						</span>
					</div>
				)}
				{departmentName && (
					<div className={cx(styles.desc, styles.text2)}>
						<HighlightText
							text={`${t("quickSearch.label.department")}：${departmentName}`}
						/>
					</div>
				)}
				<div className={contactStyles.organization}>
					<HighlightText text={departmentList} />
				</div>
				{/* <div className={contactStyles.contactsTagWrapper}> */}
				{/*	<span className={contactStyles.contactsTag}> */}
				{/*		<HighlightText text="最近联系" /> */}
				{/*	</span> */}
				{/* </div> */}
			</div>
			<div className={contactStyles.wrapper}>
				{/* <span className={ cx(contactStyles.button, contactStyles.phone) }> */}
				{/*	<IconPhoneCall size={ 20 }/> */}
				{/* </span> */}
				<span
					className={cx(contactStyles.button, contactStyles.card)}
					onClick={(event) => {
						event?.stopPropagation()
					}}
				>
					<div className={MemberCardStore.domClassName} data-user-id={item?.user_id}>
						<IconId size={20} />
					</div>
				</span>
			</div>
		</div>
	)
}

export default Contact
