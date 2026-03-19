import { useMemoizedFn } from "ahooks"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AuthApi } from "@/apis"
import type { AuthExtraData } from "./types"
import { ManagerModalType } from "./types"
import MemberDepartmentSelector from "@/components/business/MemberDepartmentSelector"
import { isMember, NodeType, OperationTypes, SegmentType, TreeNode } from "@dtyq/user-selector"
import { AuthMember, TargetTypes } from "../types"
import { useUserInfo } from "@/models/user/hooks"
import magicToast from "@/components/base/MagicToaster/utils"

export interface AuthManagerModalProps<T> {
	title?: string
	open: boolean
	extraConfig?: T
	defaultValues?: { id: string; name: string }[]
	type?: ManagerModalType
	onOk?: (data: TreeNode[]) => void
	onClose?: () => void
}

const AuthManagerModal = <T extends AuthExtraData>({
	title,
	open,
	extraConfig,
	defaultValues,
	type = ManagerModalType.Auth,
	onClose,
	onOk,
}: AuthManagerModalProps<T>) => {
	const { t } = useTranslation()

	// 获取当前用户信息
	const { userInfo } = useUserInfo()
	const currentUserId = userInfo?.user_id

	// 禁用项
	const [disabledValues, setDisabledValues] = useState<TreeNode[]>([])
	// 选中的项
	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([])

	// 转换组件所需数据结构
	const transformAuthResult = useMemoizedFn((authResult: AuthMember[]) => {
		return authResult.map((item) => {
			let dataType = NodeType.User
			// 项类型
			switch (item.target_type) {
				case TargetTypes.Department:
					dataType = NodeType.Department
					break
				case TargetTypes.Group:
					dataType = NodeType.Group
					break
				case TargetTypes.User:
				default:
					break
			}
			return {
				...item,
				id: item.target_id,
				name: item.target_info?.name || "",
				real_name: item.target_info?.real_name || "",
				dataType,
				avatar_url: item.target_info?.icon || "",
				operation: item.operation,
			}
		})
	})

	// 获取初始资源权限
	const getAuthResource = useMemoizedFn(async () => {
		const { resourceId, resourceType } = extraConfig as AuthExtraData
		if (!resourceId || !resourceType) return
		const authResult = await AuthApi.getResourceAccess(resourceType, resourceId)
		if (authResult.targets) {
			const newValues = transformAuthResult(authResult.targets)
			// 已经授权过的用户列表
			setSelectedValues(newValues)
			// 当前用户和创建者禁用
			const disableUsers = newValues.filter(
				(item) => item.id === currentUserId || item.operation === OperationTypes.Owner,
			)
			setDisabledValues(disableUsers)
		}
	})

	useEffect(() => {
		if (open) {
			if (type === ManagerModalType.Auth) {
				getAuthResource()
			} else if (defaultValues) {
				setSelectedValues(
					defaultValues.map((item) => ({
						id: item.id,
						name: item.name,
						dataType: NodeType.Department,
					})),
				)
			}
		}
	}, [defaultValues, getAuthResource, open, type])

	const onInnerOk = useMemoizedFn(async (data: TreeNode[]) => {
		if (type === ManagerModalType.Auth) {
			await AuthApi.updateResourceAccess({
				resource_type: (extraConfig as AuthExtraData).resourceType,
				resource_id: (extraConfig as AuthExtraData).resourceId,
				targets: data.map((item) => {
					return {
						target_id: item.id,
						target_type: isMember(item) ? TargetTypes.User : TargetTypes.Department,
						operation: item.operation,
						target_info: {
							id: item.id,
							name: item.name,
							description: item.description,
							icon: item.avatar_url,
						},
					}
				}),
			})
				.then(() => {
					magicToast.success(t("common.updateSuccess", { ns: "flow" }))
				})
				.catch((error) => {
					throw new Error(error)
				})
		} else {
			onOk?.(data)
		}
	})

	const afterClose = useMemoizedFn(() => {
		setSelectedValues([])
		setDisabledValues([])
	})

	return (
		<MemberDepartmentSelector
			title={title ?? t("common.manageRights", { ns: "flow" })}
			open={open}
			onlyDepartment={type === ManagerModalType.Department}
			useAuthPanel={type === ManagerModalType.Auth}
			disabledValues={disabledValues}
			selectedValues={selectedValues}
			onSelectChange={setSelectedValues}
			onOk={onInnerOk}
			onCancel={onClose}
			afterClose={afterClose}
			segmentOptions={[SegmentType.Recent, SegmentType.Organization]}
		/>
	)
}

export default AuthManagerModal
