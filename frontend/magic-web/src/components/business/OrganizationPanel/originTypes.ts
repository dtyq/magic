import type { GroupConversationDetailWithConversationId } from "@/types/chat/conversation"
import type {
	WithIdAndDataType,
	StructureItem,
	StructureItemType,
	StructureUserItem,
} from "@/types/organization"

export type DepartmentSelectItem = WithIdAndDataType<StructureItem, StructureItemType.Department>

export type UserSelectItem = WithIdAndDataType<StructureUserItem, StructureItemType.User>

export type GroupSelectItem = WithIdAndDataType<
	GroupConversationDetailWithConversationId,
	StructureItemType.Group
>

export type PartnerSelectItem = WithIdAndDataType<object, StructureItemType.Partner>

export type OrganizationSelectItem =
	| DepartmentSelectItem
	| UserSelectItem
	| GroupSelectItem
	| PartnerSelectItem
