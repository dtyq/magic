import type { MagicAvatarProps } from "@/components/base/MagicAvatar"
import MagicAvatar from "@/components/base/MagicAvatar"
import useGroupInfo from "@/hooks/chat/useGroupInfo"

interface MagicGroupAvatarProps extends MagicAvatarProps {
	gid: string
}

const MagicGroupAvatar = ({ gid, badgeProps, ...rest }: MagicGroupAvatarProps) => {
	const { groupInfo } = useGroupInfo(gid)

	return (
		<MagicAvatar src={groupInfo?.group_avatar} badgeProps={badgeProps} {...rest}>
			{groupInfo?.group_name}
		</MagicAvatar>
	)
}

export default MagicGroupAvatar
