import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"
import PersonalOrganizationAvatar from "@/opensource/assets/resources/personal-organization-avatar.svg"
import TeamOrganizationAvatar from "@/opensource/assets/resources/team-organization-avatar.svg"
import { Avatar, AvatarImage, AvatarFallback } from "@/opensource/components/shadcn-ui/avatar"

interface OrganizationAvatarRenderProps {
	size?: number
}

const OrganizationAvatarRender = observer((props: OrganizationAvatarRenderProps) => {
	const organizationCode = userStore.user.organizationCode

	const organization = userStore.user.magicOrganizationMap[organizationCode]

	const isPersonalOrganization = userStore.user.isPersonalOrganization
	const name = organization?.organization_name

	const src = isPersonalOrganization
		? PersonalOrganizationAvatar
		: (organization?.organization_logo ?? TeamOrganizationAvatar)

	return (
		<Avatar
			className="rounded-[4px] bg-muted"
			style={{ width: props.size, height: props.size }}
		>
			<AvatarImage src={src} alt={name} />
			<AvatarFallback className="rounded-[4px] bg-muted text-muted-foreground">
				<img src={TeamOrganizationAvatar} alt={name} />
			</AvatarFallback>
		</Avatar>
	)
})

export default OrganizationAvatarRender
