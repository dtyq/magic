/**
 * 简单的发布订阅系统
 */

type Listener = (...args: any[]) => void

class PubSub {
	private events: Record<string, Listener[]> = {}

	/**
	 * 订阅事件
	 * @param event 事件名称
	 * @param callback 回调函数
	 */
	subscribe(event: string, callback: Listener): void {
		if (!this.events[event]) {
			this.events[event] = []
		}
		this.events[event].push(callback)
	}

	/**
	 * 取消订阅事件
	 * @param event 事件名称
	 * @param callback 可选，特定的回调函数。如果不提供，将取消该事件的所有订阅
	 */
	unsubscribe(event: string, callback?: Listener): void {
		if (!this.events[event]) {
			return
		}

		if (callback) {
			this.events[event] = this.events[event].filter((cb) => cb !== callback)
		} else {
			delete this.events[event]
		}
	}

	/**
	 * 发布事件
	 * @param event 事件名称
	 * @param args 传递给订阅者的参数
	 */
	publish(event: string, ...args: any[]): void {
		if (!this.events[event]) {
			return
		}

		this.events[event].forEach((callback) => {
			try {
				callback(...args)
			} catch (err) {
				console.error(`Error in pubsub event handler for "${event}":`, err)
			}
		})
	}

	/**
	 * 清除所有事件订阅
	 */
	clear(): void {
		this.events = {}
	}
}

// 创建并导出单例实例
const pubsub = new PubSub()
export default pubsub

export const PubSubEvents = {
	/** 超级麦吉 - 展示快捷键列表 */
	Show_Shortcut_Keys: "PubSub_Show_Shortcut_Keys",
	/** 超级麦吉 - 打开MCP配置 */
	Open_MCP_Config: "PubSub_Open_MCP_Config",
	/** 超级麦吉 - 唤起语音输入 */
	Toggle_Voice_Input: "PubSub_Toggle_Voice_Input",
	/** 超级麦吉 - 更新项目名称 */
	Update_Project_Name: "PubSub_Update_Project_Name",
	/** 超级麦吉 - 刷新话题消息 */
	Refresh_Topic_Messages: "PubSub_Refresh_Topic_Messages",
	/** 超级麦吉 - 终止并撤销消息 */
	Interrupt_And_Undo_Message: "PubSub_Interrupt_And_Undo_Message",
	/** 超级麦吉 - 关闭所有下拉菜单 */
	Close_All_Dropdowns: "PubSub_Close_All_Dropdowns",
	/** 超级麦吉 - 隐藏撤销消息 */
	Hide_Revoked_Messages: "PubSub_Hide_Revoked_Messages",
	/** 超级麦吉 - 展示撤销消息 */
	Show_Revoked_Messages: "PubSub_Show_Revoked_Messages",
	/** 超级麦吉 - 更改预览文件 */
	Change_Preview_File: "PubSub_Change_Preview_File",
	/** 超级麦吉 - 更改预览文件的版本 */
	Change_Preview_File_Version: "PubSub_Change_Preview_File_Version",
	/** 超级麦吉 - 工作区/项目的引导元素准备完成 */
	GuideTourElementReady: "PubSub_GuideTourElementReady",
	/** 超级麦吉 - HTML文件的引导元素准备完成 */
	GuideTourHTMLElementReady: "PubSub_GuideTourHTMLElementReady",
	/** 超级麦吉 - 定时任务已更新 */
	SCHEDULED_TASK_UPDATED: "PubSub_Scheduled_Task_Updated",
	/** 超级麦吉 - 消息列表滚动到底部 */
	Message_Scroll_To_Bottom: "scroll_messages_to_bottom",
	/** 超级麦吉 - 更新活跃文件ID */
	Update_Active_File_Id: "PubSub_Update_Active_File_Id",
	/** 超级麦吉 - 定位到文件树中的文件 */
	Locate_File_In_Tree: "PubSub_Locate_File_In_Tree",
	/** 超级麦吉 - 重新编辑消息 */
	Re_Edit_Message: "PubSub_Re_Edit_Message",
	/** 超级麦吉 - 打开文件tab */
	Open_File_Tab: "super_magic_open_file_tab",
	/** 超级麦吉 - 打开演示模式tab */
	Open_Playback_Tab: "super_magic_open_playback_tab",
	/** 订阅超麦消息队列更新 */
	SuperMagicMessageQueueConsumed: "PubSub_Super_Magic_Message_Queue",
	/** 录音总结 - 接收外部消息内容，发送消息 */
	Send_Message_by_Content: "send_message_by_content",
	/** 超级麦吉 - 更新附件加载状态 */
	Update_Attachments_Loading: "update_attachments_loading",
	/** 超级麦吉 - 更新附件 */
	Update_Attachments: "update_attachments",
	/** 超级麦吉 - 进入文件全选 */
	Select_All_Files: "select_all_files",
	/** 超级麦吉 - 取消文件全选 */
	Deselect_All_Files: "deselect_all_files",
	/** 超级麦吉 - 取消文件选择模式 */
	Cancel_File_Selection: "cancel_file_selection",
	/** 超级麦吉 - 更新自动详情 */
	Super_Magic_Update_Auto_Detail: "super_magic_update_auto_detail",
	/** 超级麦吉 - 新消息 */
	Super_Magic_New_Message: "super_magic_new_message",
	/** 超级麦吉 - 创建新话题 */
	Create_New_Topic: "create_new_topic",
	/** 录音总结 - 接收音频文件 */
	Receive_RecordSummary_Audio_File: "receive_record_summary_audio_file",
	/** 超级麦吉 - 设置输入框消息 */
	Set_Input_Message: "PubSub_Set_Input_Message",
	/** 超级麦吉 - 设置目标模型 */
	Set_Target_Model: "PubSub_Set_Target_Model",
	/** 超级麦吉 - 添加内容到聊天框 */
	Add_Content_To_Chat: "add_content_to_chat",
	/** 超级麦吉 - 进入编辑状态 */
	Enter_Edit_Mode: "PubSub_Enter_Edit_Mode",
	/** 超级麦吉 - 画布 - 在光标处插入 marker 到聊天 */
	Super_Magic_Insert_Marker_To_Chat: "super_magic_insert_marker_to_chat",
	/** 超级麦吉 - 画布 - 批量同步 markers 到聊天（恢复场景） */
	Super_Magic_Sync_Markers_To_Chat: "super_magic_sync_markers_to_chat",
	/** 超级麦吉 - 画布 - marker 数据更新（Chat 与画布统一监听） */
	Super_Magic_Marker_Data_Updated: "super_magic_marker_data_updated",
	/** 超级麦吉 - 画布 - marker 已删除（source 区分来源，双方按需同步） */
	Super_Magic_Marker_Removed: "super_magic_marker_removed",
	/** 超级麦吉 - 画布 - Manager 新增 marker（草稿箱恢复/Redo 等），需同步到画布 */
	Super_Magic_Markers_Synced_To_Manager: "super_magic_markers_synced_to_manager",
	/** 超级麦吉 - 画布 - 清除画布中的所有 marker */
	Super_Magic_Clear_Canvas_Markers: "super_magic_clear_canvas_markers",
	/** 超级麦吉 - 画布 - 聚焦元素 */
	Super_Magic_Focus_Canvas_Element: "super_magic_focus_canvas_element",
	/** 超级麦吉 - 画布 - 选中标记并聚焦元素 */
	Super_Magic_Select_Marker_And_Focus: "super_magic_select_marker_and_focus",
	/** 超级麦吉 - 话题模式变化 */
	Super_Magic_Topic_Mode_Changed: "super_magic_topic_mode_changed",
	/** 超级麦吉 - 接收 app 分享的数据模式 */
	Super_Magic_Receive_Shared_Project_Mode: "super_magic_receive_shared_project_mode",
	/** 超级麦吉 - 添加文件到 MessageEditor */
	Super_Magic_Add_Files_To_MessageEditor: "super_magic_add_files_to_message_editor",
	/** 超级麦吉 - 刷新分享列表 */
	Refresh_Share_List: "PubSub_Refresh_Share_List",
	/** 超级麦吉 - 详情页刷新 */
	Super_Magic_Detail_Refresh: "super_magic_detail_refresh",

	/** 超级麦吉 - 设置内容当幻灯片添加时 */
	Set_Content_When_Slide_Added: "set_content_when_slide_added",
	/** 超级麦吉 - 设置 demo 文本到输入框 */
	Set_Demo_Text_To_Input: "PubSub_Set_Demo_Text_To_Input",
}
