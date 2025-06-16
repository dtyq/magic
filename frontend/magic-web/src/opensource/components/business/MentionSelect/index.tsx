import { MagicList } from "@/opensource/components/MagicList"
import MagicSearch from "@/opensource/components/base/MagicSearch"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { contactStore } from "@/opensource/stores/contact"
import type { StructureUserItem } from "@/types/organization"
import { useBoolean, useDebounce, useMemoizedFn } from "ahooks"
import type { PopoverProps } from "antd"
import { Flex, Popover } from "antd"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { observer } from "mobx-react-lite"

export type MentionSelectItem = {
	id: string
	name: string
	avatar: string
	// TODO
	type: "user" | "ai"
}

export interface MentionSelectProps extends Omit<PopoverProps, "open"> {
	onSelect?: (user: MentionSelectItem) => void
	keyword?: string
}

export interface MentionSelectRef {
	scrollDomRef: HTMLDivElement | null
	visible: boolean
	open: () => void
	close: () => void
	nextUser: () => void
	prevUser: () => void
	confirmItem: () => void
}

const MentionSelect = observer(
	forwardRef<MentionSelectRef, MentionSelectProps>(({ keyword, children, ...props }, ref) => {
		const { t } = useTranslation("interface")

		const { styles } = useStyles()

		const searchValue = useDebounce(keyword, { wait: 500 })
		const listRef = useRef<HTMLDivElement>(null)

		const [data, setData] = useState<StructureUserItem[]>([])
		const [isLoading, setIsLoading] = useState(false)

		useEffect(() => {
			setIsLoading(true)
			contactStore
				.getUserSearchAll(searchValue)
				.then((result) => {
					setData(result)
				})
				.finally(() => {
					setIsLoading(false)
				})
		}, [searchValue])

		const userList = useMemo(
			() =>
				data?.map?.((item) => {
					const user = item as StructureUserItem
					return {
						id: user.user_id,
						title: user.real_name,
						avatar: {
							src: user.avatar_url,
							alt: user.real_name,
							size: 20,
						},
					}
				}) ?? [],
			[data],
		)

		const [visible, { setTrue, setFalse }] = useBoolean(false)
		const [userSelectIndex, setUserSelectIndex] = useState(0)

		const scrollToIndex = useMemoizedFn((index) => {
			if (listRef.current) {
				listRef.current.children[index].scrollIntoView({ behavior: "smooth" })
			}
		})

		useEffect(() => {
			// 成员选择悬浮窗打开时，把选中索引设置到 0
			if (visible) {
				setUserSelectIndex(0)
			}
		}, [visible])

		const nextUser = useMemoizedFn(() => {
			const nextIndx = (userSelectIndex + 1) % userList.length
			setUserSelectIndex(nextIndx)
			scrollToIndex(nextIndx)
		})

		const prevUser = useMemoizedFn(() => {
			const prevIndex = (userSelectIndex - 1 + userList.length) % userList.length
			setUserSelectIndex(prevIndex)
			scrollToIndex(prevIndex)
		})

		const confirmItem = useMemoizedFn(() => {
			const target = userList[userSelectIndex]
			props.onSelect?.({
				id: target.id,
				name: target.title,
				avatar: target.avatar.src,
				type: "user",
			})
			setFalse()
		})

		useImperativeHandle(
			ref,
			() => ({
				scrollDomRef: listRef.current,
				visible,
				open: setTrue,
				close: setFalse,
				nextUser,
				prevUser,
				confirmItem,
			}),
			[visible, setTrue, setFalse, nextUser, prevUser, confirmItem],
		)

		return (
			<Popover
				autoAdjustOverflow
				styles={{
					body: {
						padding: 0,
					},
				}}
				content={
					<Flex vertical>
						<MagicSearch
							value={searchValue}
							className={styles.search}
							placeholder={t("chat.mentionPanel.search.placeholder")}
						/>
						<MagicSpin section spinning={isLoading} className={styles.list}>
							<MagicList
								ref={listRef}
								items={userList}
								active={(_, index) => index === userSelectIndex}
								onItemClick={confirmItem}
								gap={0}
							/>
						</MagicSpin>
					</Flex>
				}
				open={visible}
				{...props}
			>
				{children}
			</Popover>
		)
	}),
)

export default MentionSelect
