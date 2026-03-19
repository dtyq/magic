import { IconIdBadge, IconId } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { Flex } from "antd"
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
import { useSearchItemCommonStyles } from "./styles"

const useContactStyles = createStyles(({ token }) => {
	return {
		item: {
			position: "relative",
		},
		post: {
			fontSize: "12px",
			fontWeight: 400,
			lineHeight: "16px",
			display: "flex",
			alignItems: "center",
			gap: 2,
			color: token.magicColorUsages.text[2],
		},
		organization: {
			fontSize: "10px",
			fontStyle: "normal",
			fontWeight: 400,
			lineHeight: "12px",
			color: token.magicColorUsages.text[3],
		},
		contactsTagWrapper: {
			marginTop: 4,
		},
		contactsTag: {
			display: "inline-flex",
			padding: "3px 6px",
			alignItems: "center",
			gap: 2,
			borderRadius: 4,
			border: "1px solid #FF7D00",
			color: "#FF7D00",
			backgroundColor: "#FFFFFF",
			overflow: "hidden",
			textOverflow: "ellipsis",
			fontSize: "10px",
			fontStyle: "normal",
			fontWeight: 400,
			lineHeight: "12px",
		},
		wrapper: {
			position: "absolute",
			top: 8,
			right: 0,
		},
		button: {
			width: 36,
			height: 36,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "pointer",
			borderRadius: 4,
		},
		phone: {
			color: token.magicColorScales.green[5],
		},
		card: {
			color: token.magicColorScales.brand[5],
		},
	}
})

interface SearchItemContactProps {
	item: GlobalSearch.ContactItem
}

function Contact(props: SearchItemContactProps) {
	const { item } = props

	const { t } = useTranslation("search")
	const { styles, cx } = useSearchItemCommonStyles()
	const { styles: contactStyles } = useContactStyles()

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
			<Flex className={contactStyles.wrapper} gap={0}>
				{/* <span className={ cx(contactStyles.button, contactStyles.phone) }> */}
				{/*	<IconPhoneCall size={ 20 }/> */}
				{/* </span> */}
				<span
					className={cx(contactStyles.button, contactStyles.card)}
					style={{ color: "#315CEC" }}
					onClick={(event) => {
						event?.stopPropagation()
					}}
				>
					<div className={MemberCardStore.domClassName} data-user-id={item?.user_id}>
						<IconId size={20} />
					</div>
				</span>
			</Flex>
		</div>
	)
}

export default Contact
