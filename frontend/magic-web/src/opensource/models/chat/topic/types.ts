import type Topic from "."

/**
 * 话题列表的分类
 */
export enum TopicGroup {
	/**
	 * 所有话题
	 */
	All = "all",
	/**
	 * 置顶话题
	 */
	Pinned = "pinned",
	/**
	 * 最近使用的话题
	 */
	Recent = "recent",
}

/**
 * 话题列表
 */
export interface TopicList {
	/**
	 * 会话ID
	 */
	conversation_id: string

	/**
	 * 话题列表
	 */
	topic_list: Topic[]
}
