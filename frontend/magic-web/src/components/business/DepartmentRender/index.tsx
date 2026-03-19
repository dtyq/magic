import { observer } from "mobx-react-lite"
import { useState, useEffect, useMemo } from "react"
import { contactStore } from "@/stores/contact"
import { useMemoizedFn } from "ahooks"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import MemberCardStore from "@/stores/display/MemberCardStore"
import MagicIcon from "../../base/MagicIcon"
import { IconChevronRight } from "@tabler/icons-react"
import FlexBox from "../../base/FlexBox"

interface DepartmentRenderProps {
	path?: string
	separator?: string
	allowNavigate?: boolean
	showOrganization?: boolean
}

const DepartmentRender = observer(
	({
		path,
		separator = "/",
		allowNavigate = false,
		showOrganization = false,
	}: DepartmentRenderProps) => {
		const navigate = useNavigate()
		const [departmentInfos, setDepartmentInfos] = useState<{ id: string; name: string }[]>([])

		useEffect(() => {
			contactStore
				.getDepartmentInfos(
					path?.split("/").filter((item) => (showOrganization ? true : item !== "-1")) ||
					[],
					1,
				)
				.then((result) => {
					setDepartmentInfos(
						result.filter(Boolean).map((item) => ({
							id: item.department_id,
							name: item.name,
						})),
					)
				})
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [path])

		const departmentNames = useMemo(() => {
			return departmentInfos?.map((d) => d?.name).join(separator)
		}, [departmentInfos, separator])

		const handleNavigate = useMemoizedFn(() => {
			navigate({
				name: RouteName.ContactsOrganization,
				state: {
					departmentPath: departmentInfos,
				},
			})
			MemberCardStore.closeCard(true)
		})

		if (allowNavigate) {
			return (
				<FlexBox gap={4} align="center" flex={1}>
					<div
						style={{
							width: "100%",
							display: "inline-block",
							cursor: "pointer",
							flex: 1,
						}}
						onClick={handleNavigate}
					>
						{departmentNames}
					</div>
					<MagicIcon style={{ flexShrink: 0 }} component={IconChevronRight} size={14} />
				</FlexBox>
			)
		}

		return departmentNames
	},
)

export default DepartmentRender
