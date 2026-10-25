import { makeAutoObservable } from "mobx"
import { getFileTreeIconType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import type { I18nTexts } from "../../../../i18n"
import { MentionItemType, type MentionItem } from "../../../../types"
import { MentionPanelItemType } from "../../panel-item-types"
import {
	getMentionDescription,
	getMentionDisplayName,
	getMentionIcon,
	getMentionUniqueId,
} from "../../../../tiptap-plugin/types"
import type { MentionTabsStoreDependencies } from "./types"
import { isPlaybackTab } from "./types"
import type { TabItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { MentionFilePreviewSourceRow } from "../file-preview/preview-utils"
import { createProjectFileMentionData } from "../../../../utils/projectReferenceMention"

type MentionTabItem = TabItem & {
	data?: {
		appId?: string
		appName?: string
	}
}

export class MentionPanelTabsStore {
	currentTabs: TabItem[] = []
	private readonly getFolderMentionItemsFromTab: MentionTabsStoreDependencies["getFolderMentionItemsFromTab"]

	constructor(dependencies: MentionTabsStoreDependencies) {
		this.getFolderMentionItemsFromTab = dependencies.getFolderMentionItemsFromTab
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setTabs(tabs: TabItem[]) {
		this.currentTabs = tabs
			.reduce((prev, current) => {
				if (current.isDeleted) return prev

				prev.push(current)
				return prev
			}, [] as TabItem[])
			.sort((a, b) => (b.active_at || 0) - (a.active_at || 0))
	}

	tabToMentionItem(tab: MentionTabItem): MentionItem {
		if (tab.type === "micro_app") {
			// Published micro-app tabs intentionally have no fileData. Preserve their
			// app identity so the micro-app renderer can provide its product icon.
			const appId = typeof tab.data?.appId === "string" ? tab.data.appId.trim() : ""
			if (appId) {
				const appName =
					typeof tab.data?.appName === "string"
						? tab.data.appName.trim() || tab.title
						: tab.title
				return {
					id: `micro-app:${appId}`,
					name: appName,
					type: MentionItemType.MICRO_APP,
					data: { app_id: appId, app_name: appName },
					hasChildren: false,
					isFolder: false,
					tags: ["tab"],
				}
			}
		}

		const data = {
			type: MentionItemType.PROJECT_FILE,
			data: createProjectFileMentionData(tab.fileData, {
				fileId: tab.id,
				fileName: tab.title,
				filePath: tab.filePath,
			}),
		}

		const id = getMentionUniqueId(data)
		const name = getMentionDisplayName(data)
		const icon = tab.fileData.display_config?.type
			? getFileTreeIconType(tab.fileData) || "ts-attachment"
			: getMentionIcon(data)
		const description = getMentionDescription(data)

		return {
			id,
			name,
			description,
			type: MentionItemType.PROJECT_FILE,
			data: data.data,
			displayConfig: tab.fileData.display_config,
			icon,
			hasChildren: false,
			isFolder: false,
			tags: ["tab"],
		}
	}

	getTabsAsMentionItems(count: number = 5, t: I18nTexts): MentionItem[] {
		const tabs = this.getCurrentTabs()

		if (tabs.length <= count) return tabs

		return tabs.slice(0, count).concat([
			{
				id: "tabs",
				type: MentionPanelItemType.TABS,
				name: t.historyActions.viewAllOpenFiles,
				hasChildren: true,
				isFolder: true,
			},
		])
	}

	getCurrentTabs(): MentionItem[] {
		const fileTabs = this.currentTabs.filter((item) => !isPlaybackTab(item))

		return fileTabs.map((item) => {
			const folderItem = this.getFolderMentionItemsFromTab(item)
			if (folderItem) {
				return {
					...(folderItem as MentionItem),
					tags: ["tab"],
				}
			}

			return this.tabToMentionItem(item)
		})
	}

	get currentTabPreviewRows(): MentionFilePreviewSourceRow[] {
		const rows: MentionFilePreviewSourceRow[] = []
		for (const tab of this.currentTabs) {
			if (isPlaybackTab(tab)) continue
			rows.push({
				file_id: tab.fileData.file_id,
				updated_at: tab.fileData.updated_at,
				relative_file_path: tab.fileData.relative_file_path,
				file_url: tab.fileData.file_url,
				url: tab.fileData.url,
			})
		}

		return rows
	}
}
