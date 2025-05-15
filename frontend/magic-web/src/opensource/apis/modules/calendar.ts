import { genRequestUrl } from "@/utils/http"
import type { Calendar } from "@/types/calendar"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generateCalendarApi = (fetch: HttpClient) => ({
	/** 创建日程 */
	createCalendar(params: Calendar.SaveCalendarParams) {
		return fetch.post<{ id: string }>(genRequestUrl(RequestUrl.createCalendar), params)
	},

	/** 创建AI日程 */
	createAiCalendar(params: Calendar.SaveAiCalendarParams) {
		return fetch.post<Calendar.CalendarDetail>(
			genRequestUrl(RequestUrl.createAiCalendar),
			params,
		)
	},

	/** 获取日程详情 */
	getCalendarDetail(id: string) {
		return fetch.get<Calendar.CalendarDetail>(
			genRequestUrl(RequestUrl.getCalendarDetail, { id }, { schedule_id: id }),
		)
	},

	/** 修改日程 */
	updateCalendar(params: Calendar.SaveCalendarParams) {
		return fetch.put<{ id: string }>(genRequestUrl(RequestUrl.updateCalendar), params)
	},

	/** 删除日程 */
	deleteCalendar(params: Calendar.DeleteCalendarParams) {
		return fetch.delete<null>(
			genRequestUrl(RequestUrl.deleteCalendar, { id: params.schedule_id }),
		)
	},

	/** 获取指定天中的日程安排 */
	getCalendar(params: Calendar.GetCalendarByDayParams) {
		return fetch.post<Calendar.ListItem[]>(genRequestUrl(RequestUrl.getCalendarByDay), params)
	},

	/** 用户闲忙状态 */
	getUserStatus(params: Calendar.GetUserStatusParams) {
		return fetch.get<Calendar.UserStatus[]>(genRequestUrl(RequestUrl.getUserStatus, {}, params))
	},

	/** 评论日程 */
	commentCalendar(params: Calendar.CommentCalendarParams) {
		return fetch.post<Calendar.Comments>(
			genRequestUrl(RequestUrl.commentCalendar, { id: params.schedule_id }),
			params,
		)
	},

	/** 添加邀请人 */
	addParticipant(params: Calendar.AddParticipantParams) {
		return fetch.post<null>(genRequestUrl(RequestUrl.addParticipant, { id: params.id }), params)
	},

	/** 转让日程组织者 */
	transferOrganizer(params: Calendar.TransferOrganizerParams) {
		return fetch.put<null>(
			genRequestUrl(RequestUrl.transferOrganizer, { id: params.schedule_id }),
			params,
		)
	},

	/** 获取会议室 */
	getMeetingRoom(params: Calendar.MeetingRoomParams) {
		return fetch.post<Calendar.MeetingRoom[]>(genRequestUrl(RequestUrl.getMeetingRooms), params)
	},

	/** 获取会议室的筛选条件 */
	getFilteringCriteria() {
		return fetch.get<Calendar.FilteringCriteria>(genRequestUrl(RequestUrl.getFilteringCriteria))
	},

	/** 获取指定时间段的空闲会议室 */
	getAvailableMeetingRoom(params: Calendar.TimeAvailableParams) {
		return fetch.get<Calendar.MeetingRoom[]>(
			genRequestUrl(RequestUrl.getAvaliableMeetingRooms, {}, params),
		)
	},

	/** 获取/新建日程纪要 */
	getSummary(id: string) {
		return fetch.get<string>(genRequestUrl(RequestUrl.getCalendarSummary, { id }))
	},

	/** 修改日程邀请状态 */
	updateCalendarStatus(params: Calendar.UpdateCalendarStatusParams) {
		return fetch.put<null>(
			genRequestUrl(RequestUrl.updateCalendarStatus, { id: params.schedule_id }),
			params,
		)
	},

	/** 创建群聊 */
	createCalendarGroup(params: { schedule_id: string }) {
		return fetch.post<{ group_id: string }>(
			genRequestUrl(RequestUrl.createCalendarGroup, { id: params.schedule_id }),
			params,
		)
	},
})
