import { DRIVE_SPACE_KEY_MAP } from "@/constants/file"
import { RoutePath } from "@/constants/routes"
import { DriveItemFileType } from "@/types/drive"
import type { DriveSpaceType, DriveItem } from "@/types/drive"
import { getDriveFileRedirectUrl } from "../drive"
import { env } from "../env"

export function genDriveItemUrl(
	record: Pick<DriveItem, "file_id" | "file_type" | "space_type">,
	withOrigin?: boolean,
) {
	if (record.file_type === DriveItemFileType.FOLDER) {
		return `${withOrigin ? window.location.origin : ""}${RoutePath.DriveRecent}/${DRIVE_SPACE_KEY_MAP[record.space_type as DriveSpaceType.Me | DriveSpaceType.Shared]
			}/${record.file_id}`
	}
	return withOrigin
		? env("MAGIC_TEAMSHARE_BASE_URL") +
		getDriveFileRedirectUrl(record.file_id, record.file_type)
		: `${getDriveFileRedirectUrl(record.file_id, record.file_type)}`
}
