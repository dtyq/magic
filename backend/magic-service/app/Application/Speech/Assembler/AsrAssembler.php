<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Codec\Json;

/**
 * ASR 组装器
 * 负责 ASR 相关的实体组装和路径转换.
 *
 * 路径格式说明：
 * - 工作区相对路径 (workspace-relative): .asr_recordings/session_xxx 或 录音总结_xxx
 * - 项目工作目录 (work directory): project_123/workspace
 * - 组织码+APP_ID+bucket_md5前缀 (full prefix): DT001/open/5f4dcc3b5aa765d61d8327deb882cf99/
 * - 完整路径/file_key (full path): DT001/open/5f4dcc3b5aa765d61d8327deb882cf99/project_123/workspace/.asr_recordings/session_xxx
 */
class AsrAssembler
{
    /**
     * 创建目录实体.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param int $projectId 项目ID
     * @param string $relativePath 相对路径（如：.asr_recordings/task_123 或 录音总结_xxx）
     * @param string $fullPrefix 完整前缀（组织码+APP_ID+bucket_md5，如：DT001/open/5f4dcc3b5aa765d61d8327deb882cf99/）
     * @param string $workDir 工作目录
     * @param int $rootDirectoryId 根目录ID
     * @param bool $isHidden 是否为隐藏目录
     * @param null|string $taskKey 任务键（仅隐藏目录需要）
     */
    public static function createDirectoryEntity(
        string $userId,
        string $organizationCode,
        int $projectId,
        string $relativePath,
        string $fullPrefix,
        string $workDir,
        int $rootDirectoryId,
        bool $isHidden = false,
        ?string $taskKey = null
    ): TaskFileEntity {
        // 构建 metadata
        $metadata = [
            'created_by' => 'asr_prepare_recording',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        if ($isHidden) {
            $metadata['asr_temp_directory'] = true;
            if ($taskKey !== null) {
                $metadata['task_key'] = $taskKey;
            }
        } else {
            $metadata['asr_display_directory'] = true;
        }

        // 构建完整的 file_key
        $fileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $relativePath);
        $fileKey = rtrim($fileKey, '/') . '/';

        // 确定文件名：隐藏目录使用 basename，显示目录使用完整路径
        $fileName = $isHidden ? basename($relativePath) : $relativePath;

        return new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => FileType::DIRECTORY->value,
            'file_name' => $fileName,
            'file_extension' => '',
            'file_key' => $fileKey,
            'file_size' => 0,
            'external_url' => '',
            'storage_type' => StorageType::WORKSPACE->value,
            'is_hidden' => $isHidden,
            'is_directory' => true,
            'sort' => 0,
            'parent_id' => $rootDirectoryId,
            'source' => TaskFileSource::PROJECT_DIRECTORY->value,
            'metadata' => Json::encode($metadata),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * 构建完整 file_key.
     *
     * 转换关系: file_key = fullPrefix + workDir + "/" + relativePath
     *
     * @param string $fullPrefix 组织码+APP_ID+bucket_md5前缀 (如: DT001/open/5f4dcc3b5aa765d61d8327deb882cf99/)
     * @param string $workDir 项目工作目录 (如: project_123/workspace)
     * @param string $relativePath 工作区相对路径 (如: .asr_recordings/session_xxx)
     * @return string 完整 file_key (如: DT001/open/5f4dcc3b5aa765d61d8327deb882cf99/project_123/workspace/.asr_recordings/session_xxx)
     */
    public static function buildFileKey(
        string $fullPrefix,
        string $workDir,
        string $relativePath
    ): string {
        return WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $relativePath);
    }

    /**
     * 从 file_key 提取工作区相对路径.
     *
     * 将完整的 file_key 转换为工作区相对路径，用于沙箱 API 调用和界面展示
     * 转换关系: relativePath = extractWorkspaceRelativePath(file_key)
     *
     * @param string $fileKey 完整 file_key (如: DT001/open/5f4dcc3b5aa765d61d8327deb882cf99/project_123/workspace/.asr_recordings/session_xxx)
     * @return string 工作区相对路径 (如: .asr_recordings/session_xxx)
     */
    public static function extractWorkspaceRelativePath(string $fileKey): string
    {
        // 标准化路径分隔符
        $normalizedPath = str_replace('\\', '/', trim($fileKey, '/'));

        // 查找 workspace/ 的位置
        $workspacePos = strpos($normalizedPath, '/workspace/');
        if ($workspacePos !== false) {
            // 提取 workspace/ 后面的部分
            $relativePath = substr($normalizedPath, $workspacePos + 11); // 11 = strlen('/workspace/')

            // 如果相对路径不为空，返回相对路径
            if (! empty($relativePath)) {
                return $relativePath;
            }
        }

        // 如果没有找到 /workspace/，尝试查找 workspace/ 开头的情况
        if (str_starts_with($normalizedPath, 'workspace/')) {
            $relativePath = substr($normalizedPath, 10); // 移除 'workspace/' 前缀
            if (! empty($relativePath)) {
                return $relativePath;
            }
        }

        // 如果都没找到workspace标识，直接返回原始路径（可能已经是相对路径）
        return $normalizedPath;
    }
}
