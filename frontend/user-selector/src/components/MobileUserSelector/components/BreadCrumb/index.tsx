import { useMemo } from "react"
import type { FC } from "react"
import { SelectedPath, Organization, SegmentType } from "@/components/UserSelector/types"
import { useAppearance } from "@/context/AppearanceProvider"
import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { CommonBreadCrumb } from "@/components/OrganizationPanel/components/BreadCurmb"

interface Props {
	segment?: SegmentType
	organization?: Organization
	selectedPath: SelectedPath[]
	onItemClick: (index: number) => void
}

export const SelectorBreadcrumb: FC<Props> = ({
	segment,
	organization,
	selectedPath,
	onItemClick,
}) => {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	const SegmentOption = useMemo(() => {
		return {
			[SegmentType.Organization]: locale.segment.org,
			[SegmentType.Recent]: locale.segment.recent,
			[SegmentType.Group]: locale.segment.group,
			[SegmentType.UserGroup]: locale.segment.userGroup,
			[SegmentType.Partner]: locale.segment.partner,
			[SegmentType.Resigned]: locale.segment.resigned,
			[SegmentType.ShareToMember]: locale.segment.shareToMember,
			[SegmentType.ShareToGroup]: locale.segment.shareToGroup,
		}
	}, [locale])

	const showOrganization = organization && segment !== SegmentType.ShareToGroup

	return (
		<Breadcrumb className="py-2">
			<BreadcrumbList className="flex-nowrap">
				{segment && (
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<button onClick={() => onItemClick(-2)}>
								{SegmentOption[segment]}
							</button>
						</BreadcrumbLink>
					</BreadcrumbItem>
				)}
				{showOrganization && (
					<>
						{segment && <BreadcrumbSeparator />}
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<button onClick={() => onItemClick(-1)}>{organization.name}</button>
							</BreadcrumbLink>
						</BreadcrumbItem>
					</>
				)}
				<CommonBreadCrumb selectedPath={selectedPath} onItemClick={onItemClick} />
			</BreadcrumbList>
		</Breadcrumb>
	)
}

export default SelectorBreadcrumb
