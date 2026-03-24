const getSuperProjectShare = require("../apis/getSuperProjectShare")
const getSuperMagicShareResource = require("../apis/getSuperMagicShareResource")
const getSuperProjectName = require("../apis/getSuperProjectName")
const getClusterConfiguration = require("../apis/getClusterConfiguration")
const getApprovalShare = require("../apis/getApprovalShare")
const getFileInfo = require("../apis/getFileInfo")
const getShareForm = require("../apis/getShareForm")

class SEO {
	/** 分享话题 */
	async shareTopic(req, res, next) {
		const { topicId } = req.params

		if (!topicId) {
			throw new Error("topicId is required")
		}

		const password = req.query.password || ""
		const data = await getSuperProjectShare(topicId, password)

		const name = data?.data?.resource_name
		return {
			title: name || "Magic Shared",
			description: name,
			keywords: name,
		}
	}

	/** 分享资源(文件集合) */
	async shareResource(req, res, next) {
		const { resourceId } = req.params

		if (!resourceId) {
			throw new Error("resourceId is required")
		}

		const data = await getSuperMagicShareResource(resourceId)

		const name = data?.data?.resource_name || data?.data?.project_name || data?.data?.topic_name
		const description = data?.data?.file_names?.join(",") || data?.data?.topic_name
		return {
			title: name || "Magic Shared",
			description: description,
			keywords: name,
		}
	}

	/** 协作话题 */
	async collaborationTopic(req, res, next) {
		const { projectId } = req.params

		if (!projectId) {
			throw new Error("projectId is required")
		}

		// 项目信息
		const projectInfo = await getSuperProjectName(projectId)

		return {
			title: projectInfo?.data?.project_name || req.__("superMagic.collaborationProject"),
			description:
				projectInfo?.data?.project_name || req.__("superMagic.collaborationProject"),
			keywords: projectInfo?.data?.project_name || req.__("superMagic.collaborationProject"),
		}
	}

	/** 协作话题 */
	async personalTopic(req, res, next) {
		const { projectId } = req.params

		if (!projectId) {
			throw new Error("projectId is required")
		}

		// 项目信息
		const projectInfo = await getSuperProjectName(projectId)

		return {
			title: projectInfo?.data?.project_name || req.__("superMagic.project"),
			description: projectInfo?.data?.project_name || req.__("superMagic.project"),
			keywords: projectInfo?.data?.project_name || req.__("superMagic.project"),
		}
	}

	/** 协作项目 */
	async collaborationProject(req, res, next) {
		const { projectId } = req.params

		if (!projectId) {
			throw new Error("projectId is required")
		}

		// 项目信息
		const projectInfo = await getSuperProjectName(projectId)

		return {
			title: projectInfo?.data?.project_name || req.__("superMagic.collaborationProject"),
			description:
				projectInfo?.data?.project_name || req.__("superMagic.collaborationProject"),
			keywords: projectInfo?.data?.project_name || req.__("superMagic.collaborationProject"),
		}
	}

	/** 个人项目 */
	async personalProject(req, res, next) {
		const { projectId } = req.params

		if (!projectId) {
			throw new Error("projectId is required")
		}

		// 项目信息
		const projectInfo = await getSuperProjectName(projectId)

		return {
			title: projectInfo?.data?.project_name || req.__("superMagic.project"),
			description: projectInfo?.data?.project_name || req.__("superMagic.project"),
			keywords: projectInfo?.data?.project_name || req.__("superMagic.project"),
		}
	}

	/** 审批 */
	async approval(req, res, next) {
		const { id, access_token } = req.query
		const { clusterCode } = req.params

		if (!id) {
			throw new Error("id is required")
		}
		if (!clusterCode) {
			throw new Error("clusterCode is required")
		}
		const { teamshareUrl } = await getClusterConfiguration(clusterCode)

		const data = await getApprovalShare(id, teamshareUrl, { access_token })

		return {
			title: data?.title || req.__("approval.title"),
			description: data?.title || req.__("approval.title"),
			keywords: data?.title || req.__("approval.title"),
		}
	}

	/** 云文档 */
	async docx(req, res, next) {
		const { clusterCode, fileId } = req.params

		if (!fileId) {
			throw new Error("fileId is required")
		}
		if (!clusterCode) {
			throw new Error("clusterCode is required")
		}
		// 解析集群
		const { teamshareUrl } = await getClusterConfiguration(clusterCode)
		const data = await getFileInfo(fileId, teamshareUrl)

		return {
			title: data?.name || req.__("file.docs"),
			description: data?.name || req.__("file.docs"),
			keywords: data?.name || req.__("file.docs"),
		}
	}

	/** 多维表格 */
	async pivotTable(req, res, next) {
		const { clusterCode, fileId } = req.params

		if (!fileId) {
			throw new Error("fileId is required")
		}
		if (!clusterCode) {
			throw new Error("clusterCode is required")
		}
		// 解析集群
		const { teamshareUrl } = await getClusterConfiguration(clusterCode)
		const data = await getFileInfo(fileId, teamshareUrl)

		return {
			title: data?.name || req.__("file.pivotTable"),
			description: data?.name || req.__("file.pivotTable"),
			keywords: data?.name || req.__("file.pivotTable"),
		}
	}

	/** 多维表格 - 共享表单 */
	async sharedForm(req, res, next) {
		const { clusterCode, fileId, viewId } = req.params

		if (!fileId) {
			throw new Error("fileId is required")
		}
		if (!clusterCode) {
			throw new Error("clusterCode is required")
		}
		// 解析集群
		const { teamshareUrl } = await getClusterConfiguration(clusterCode)
		const data = await getShareForm(fileId, viewId, teamshareUrl)

		return {
			title: data?.name || req.__("file.sharedForm"),
			description: data?.name || req.__("file.sharedForm"),
			keywords: data?.name || req.__("file.sharedForm"),
		}
	}

	/** 通用文档类型解析: WPS文档、资源文档、白板 */
	async file(req, res, next) {
		const { clusterCode, fileId } = req.params

		if (!fileId) {
			throw new Error("fileId is required")
		}
		if (!clusterCode) {
			throw new Error("clusterCode is required")
		}
		// 解析集群
		const { teamshareUrl } = await getClusterConfiguration(clusterCode)
		const data = await getFileInfo(fileId, teamshareUrl)

		return {
			title: data?.name || req.__("file.document"),
			description: data?.name || req.__("file.document"),
			keywords: data?.name || req.__("file.document"),
		}
	}

	/**
	 * 知识库目录（微前端天书内分享的链接）
	 * 通过 getFileInfo 拉取知识库对应文件名写入 og，平台名用默认产品名（useDefaultPlatformTitle）；无文件名时不使用兜底文案
	 */
	async knowledgeDirectory(req, res, next) {
		const { clusterCode, fileId } = req.params
		if (!clusterCode || !fileId) {
			return {
				title: req.__("file.document"),
				description: req.__("file.document"),
				keywords: req.__("file.document"),
				useDefaultPlatformTitle: true
			}
		}
		try {
			const { teamshareUrl } = await getClusterConfiguration(clusterCode)
			let data = await getFileInfo(fileId, teamshareUrl)
			const title = data?.name || req.__("file.document")
			return {
				title,
				description: title,
				keywords: title,
				useDefaultPlatformTitle: true
			}
		} catch (_) {
			const title = req.__("file.document")
			return {
				title,
				description: title,
				keywords: title,
			}
		}
	}

	/** 云盘：个人 */
	async drivePersonal(req, res, next) {
		return {
			title: req.__("drive.personal"),
			description: req.__("drive.personal"),
			keywords: req.__("drive.personal"),
		}
	}

	/** 云盘：个人创建的资源 */
	async driveMine(req, res, next) {
		return {
			title: req.__("drive.personal"),
			description: req.__("drive.personal"),
			keywords: req.__("drive.personal"),
		}
	}

	/** 云盘：常用 */
	async driveRecent(req, res, next) {
		return {
			title: req.__("drive.personal"),
			description: req.__("drive.personal"),
			keywords: req.__("drive.personal"),
		}
	}

	/** 云盘：企业云盘 */
	async driveShared(req, res, next) {
		return {
			title: req.__("drive.shared"),
			description: req.__("drive.shared"),
			keywords: req.__("drive.shared"),
		}
	}

	/** 云盘文件夹 */
	async folder(req, res, next) {
		const { clusterCode, folderId } = req.params

		if (!folderId) {
			throw new Error("folderId is required")
		}
		if (!clusterCode) {
			throw new Error("clusterCode is required")
		}
		// 解析集群
		const { teamshareUrl } = await getClusterConfiguration(clusterCode)
		const data = await getFileInfo(folderId, teamshareUrl)

		return {
			title: data?.name || req.__("drive.folder"),
			description: data?.name || req.__("drive.folder"),
			keywords: data?.name || req.__("drive.folder"),
		}
	}

	/** 登录 */
	async login(req, res, next) {
		return {
			title: req.__("login.title"),
			description: req.__("login.title"),
			keywords: req.__("login.title"),
		}
	}
}

module.exports = SEO
