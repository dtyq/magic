import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface OpenMessageFileOptions {
	locateInTree?: boolean
}

function resolveMessageFileId(fileData: any): string | null {
	return (
		fileData?.file_id ||
		fileData?.data?.file_id ||
		fileData?.currentFileId ||
		fileData?.id ||
		null
	)
}

export function openMessageFile(
	fileData: unknown,
	options: OpenMessageFileOptions = {},
): string | null {
	const fileId = resolveMessageFileId(fileData)
	if (!fileId) return null

	pubsub.publish("super_magic_switch_detail_mode", "files")
	pubsub.publish(PubSubEvents.Open_File_Tab, {
		fileId,
		fileData,
	})

	if (options.locateInTree ?? true) {
		pubsub.publish(PubSubEvents.Locate_File_In_Tree, fileId)
	}

	return fileId
}
