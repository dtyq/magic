export type CollaboratorPermission = "editor" | "viewer" | "manage" | "owner" | "collaborator"

export const enum CollaboratorPermissionEnum {
	OWNER = "owner",
	EDITABLE = "editor",
	READONLY = "viewer",
	MANAGE = "manage",
	COLLABORATOR = "collaborator",
}
