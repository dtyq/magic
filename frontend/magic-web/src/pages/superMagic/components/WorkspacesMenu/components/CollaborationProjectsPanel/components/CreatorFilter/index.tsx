import { forwardRef, memo, useImperativeHandle, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconFilter, IconChevronDown, IconCheck } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import MagicDropdown from "@/components/base/MagicDropdown"
import { type CreatorFilterProps } from "../types"
import MagicAvatarStack from "@/components/base/MagicAvatarStack"
import { CollaborationProjectCreator } from "@/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import { useMemoizedFn, useMount } from "ahooks"
import MagicAvatar from "@/components/base/MagicAvatar"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

export interface CreatorFilterComponentRef {
	refreshCreators: () => void
}

const CreatorFilterComponent = forwardRef<CreatorFilterComponentRef, CreatorFilterProps>(
	({ value, onChange }: CreatorFilterProps, ref: React.Ref<CreatorFilterComponentRef>) => {
		const { t } = useTranslation("super")

		const [creators, setCreators] = useState<CollaborationProjectCreator[]>([])
		const [keyword, setKeyword] = useState("")

		const filteredCreators = useMemo(() => {
			const normalizedKeyword = keyword.trim().toLowerCase()
			if (!normalizedKeyword) return creators
			return creators.filter((creator) =>
				creator.name.toLowerCase().includes(normalizedKeyword),
			)
		}, [creators, keyword])

		const refreshCreators = useMemoizedFn(() => {
			SuperMagicApi.getCollaborationProjectCreators().then((res) => setCreators(res || []))
		})

		useMount(() => {
			refreshCreators()
		})

		useImperativeHandle(ref, () => ({
			refreshCreators: () => {
				refreshCreators()
			},
		}))

		return (
			<MagicDropdown
				contentRole="panel"
				overlayClassName="w-[180px] p-0"
				popupRender={() => (
					<div className="w-full" onClick={(event) => event.stopPropagation()}>
						<Input
							value={keyword}
							onChange={(event) => setKeyword(event.target.value)}
							placeholder={t("project.searchCreator")}
							className="h-10 rounded-none border-0 border-b border-border/60 bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
							onKeyDown={(event) => event.stopPropagation()}
						/>
						<ScrollArea
							viewportClassName="max-h-60 overscroll-contain p-1.5 [&>div]:!block"
							viewportProps={{ onWheel: (event) => event.stopPropagation() }}
						>
							{filteredCreators.map((item) => {
								const selected = value.some((v) => v.user_id === item.user_id)
								return (
									<button
										key={item.user_id}
										type="button"
										className="flex min-h-10 w-full items-center gap-2 truncate rounded-lg px-2 py-1 text-left text-sm hover:bg-accent"
										onClick={() => onChange(item)}
									>
										<MagicAvatar src={item.avatar_url} size={20} shape="circle">
											{item.name}
										</MagicAvatar>
										<span className="flex-1">{item.name}</span>
										{selected && (
											<MagicIcon
												component={IconCheck}
												size={16}
												className="text-primary"
												stroke={2}
											/>
										)}
									</button>
								)
							})}
							{filteredCreators.length === 0 && (
								<div className="px-2 py-3 text-center text-xs text-muted-foreground">
									{t("project.noCreators")}
								</div>
							)}
						</ScrollArea>
					</div>
				)}
			>
				<div className="flex h-8 cursor-pointer items-center rounded-lg px-2.5 transition-all duration-200 hover:bg-fill">
					<div className="flex items-center gap-1">
						<MagicIcon component={IconFilter} size={16} />
						<span className="text-xs font-normal leading-4 text-muted-foreground">
							{t("project.creator")}
						</span>
						<span className="text-xs font-normal leading-4 text-foreground">
							{value.length === 0 ? (
								t("project.all")
							) : value.length === 1 ? (
								<div className="flex items-center gap-1">
									<MagicAvatar src={value[0].avatar_url} size={20} shape="circle">
										{value[0].name}
									</MagicAvatar>
									<span>{value[0].name}</span>
								</div>
							) : (
								<MagicAvatarStack
									members={value.map((item) => ({
										id: item.user_id,
										name: item.name,
										avatar_url: item.avatar_url,
									}))}
									totalCount={value.length}
								/>
							)}
						</span>
						<MagicIcon component={IconChevronDown} size={14} />
					</div>
				</div>
			</MagicDropdown>
		)
	},
)

export default memo(CreatorFilterComponent)
