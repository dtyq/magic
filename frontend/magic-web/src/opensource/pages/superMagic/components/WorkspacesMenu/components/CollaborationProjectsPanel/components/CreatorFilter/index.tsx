import { forwardRef, memo, useImperativeHandle, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconFilter, IconChevronDown, IconCheck } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import { type CreatorFilterProps } from "../types"
import MagicAvatarStack from "@/opensource/components/base/MagicAvatarStack"
import { MenuProps } from "antd"
import { CollaborationProjectCreator } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/opensource/apis"
import { useMemoizedFn, useMount } from "ahooks"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"

export interface CreatorFilterComponentRef {
	refreshCreators: () => void
}

const CreatorFilterComponent = forwardRef<CreatorFilterComponentRef, CreatorFilterProps>(
	({ value, onChange }: CreatorFilterProps, ref: React.Ref<CreatorFilterComponentRef>) => {
		const { t } = useTranslation("super")

		const [creators, setCreators] = useState<CollaborationProjectCreator[]>([])

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
				menu={{
					items: creators.map((item) => ({
						key: item.user_id,
						label: (
							<div className="flex items-center gap-1">
								<MagicAvatar src={item.avatar_url} size={20} shape="circle">
									{item.name}
								</MagicAvatar>
								<span className="flex-1">{item.name}</span>
								{value.some((v) => v.user_id === item.user_id) && (
									<MagicIcon
										component={IconCheck}
										size={16}
										color="currentColor"
										className="text-primary"
										stroke={2}
									/>
								)}
							</div>
						),
						onClick: () => onChange(item),
					})) as MenuProps["items"],
				}}
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
