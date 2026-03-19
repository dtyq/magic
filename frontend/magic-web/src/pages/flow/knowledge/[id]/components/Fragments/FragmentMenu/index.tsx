import MagicDropdown from "@/components/base/MagicDropdown"
import type { Knowledge } from "@/types/knowledge"
import { Modal, type MenuProps } from "antd"
import type React from "react"
import { useMemo } from "react"
import MagicIcon from "@/components/base/MagicIcon"
import { IconEdit, IconTrash } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

const MenuKeys = {
	Edit: 1,
	Delete: 2,
}

interface FragmentMenuProps extends React.PropsWithChildren {
	fragment: Knowledge.FragmentItem
	deleteFragmentById: (id: string) => void
	updateFragmentById: (id: string) => void
	[key: string]: any
}

export default function FragmentMenu({
	fragment,
	children,
	deleteFragmentById,
	updateFragmentById,
	...props
}: FragmentMenuProps) {
	const { t } = useTranslation()

	/** 删除片段 */
	const deleteItem = useMemoizedFn(() => {
		Modal.confirm({
			centered: true,
			title: t("knowledgeDatabase.deleteFragment", { ns: "flow" }),
			content: t("knowledgeDatabase.deleteFragmentDesc", { ns: "flow" }),
			okText: t("button.confirm", { ns: "interface" }),
			cancelText: t("button.cancel", { ns: "interface" }),
			onOk: async () => {
				await KnowledgeApi.deleteFragment(fragment.id)
				magicToast.success(t("knowledgeDatabase.deleteFragmentSuccess", { ns: "flow" }))
				deleteFragmentById(fragment.id)
			},
		})
	})

	/** 编辑片段 */
	const editItem = useMemoizedFn(() => {
		updateFragmentById(fragment.id)
	})

	const menuItems = useMemo<Exclude<MenuProps["items"], undefined>>(() => {
		return [
			{
				key: MenuKeys.Delete,
				label: t("common.delete", { ns: "flow" }),
				icon: <MagicIcon component={IconTrash} size={18} />,
				onClick: deleteItem,
			},
			{
				key: MenuKeys.Edit,
				label: t("common.edit", { ns: "flow" }),
				icon: <MagicIcon component={IconEdit} size={18} />,
				onClick: editItem,
			},
		]
	}, [deleteItem, editItem, t])

	return (
		<MagicDropdown trigger={["contextMenu"]} menu={{ items: menuItems }} {...props}>
			{children}
		</MagicDropdown>
	)
}
