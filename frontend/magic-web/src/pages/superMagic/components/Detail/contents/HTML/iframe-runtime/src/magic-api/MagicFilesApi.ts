/**
 * @deprecated 请使用 MagicWorkspaceApi 代替。
 *
 * MagicFilesApi 已重命名为 MagicWorkspaceApi，以更准确地体现其职责：
 * 工作区级文件操作（OSS 上传、浏览器下载、附加到话题消息输入框），
 * 与低层文本 I/O 的 MagicFSApi 加以区分。
 *
 * 此文件仅保留以维持向后兼容，底层实现已统一到 MagicWorkspaceApi。
 * 下一个大版本中将移除此文件，请直接引用 MagicWorkspaceApi。
 */

export { MagicWorkspaceApi as MagicFilesApi } from "./MagicWorkspaceApi"
