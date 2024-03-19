/**
 * @description 白名单路由
 * 用于路由鉴权判断，以下路由不需要进行鉴权
 */

export const whiteListRoutes = [
	/** 知识库预览 */
	"/:clusterCode/knowledge/preview/*",
	/** 云文档 */
	"/:clusterCode/docx/*",
	/** 白板 */
	"/:clusterCode/whiteboard/*",
	/** Office文档 */
	"/:clusterCode/office/*",
	/** 多维表格(开放白名单导致鉴权问题，知识库下多维表场景需要免登) */
	"/:clusterCode/base/*",
	/** 多维表格表单视图 */
	"/:clusterCode/form/*",
	/** 知识库目录 */
	"/:clusterCode/knowledge/directory/*",
	/** 文件 */
	"/:clusterCode/file/*",
	/** 分享 */
	"/share/*",
	/** 激活 */
	"/activation/*",
	/** 系统初始化 */
	"/initialization",
]
