<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Hyperf\Codec\Json;

/**
 * ASR目录组装器 - 负责创建目录相关的实体.
 */
class AsrDirectoryAssembler
{
    /**
     * 创建隐藏目录的 TaskFileEntity.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param int $projectId 项目ID
     * @param string $hiddenDirName 隐藏目录名称（如：.asr_recordings/task_123）
     * @param string $hiddenDirPath 隐藏目录完整路径
     * @param int $rootDirectoryId 根目录ID
     * @param string $taskKey 任务键
     */
    public static function createHiddenDirectoryEntity(
        string $userId,
        string $organizationCode,
        int $projectId,
        string $hiddenDirName,
        string $hiddenDirPath,
        int $rootDirectoryId,
        string $taskKey
    ): TaskFileEntity {
        $metadata = [
            'asr_temp_directory' => true,
            'task_key' => $taskKey,
            'created_by' => 'asr_prepare_recording',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        return new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => 'directory',
            'file_name' => basename($hiddenDirName),
            'file_extension' => '',
            'file_key' => $hiddenDirPath,
            'file_size' => 0,
            'external_url' => '',
            'storage_type' => 'workspace',
            'is_hidden' => true, // 标记为隐藏
            'is_directory' => true,
            'sort' => 0,
            'parent_id' => $rootDirectoryId,
            'source' => 2, // 2-项目目录
            'metadata' => Json::encode($metadata),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * 创建显示目录的 TaskFileEntity.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param int $projectId 项目ID
     * @param string $directoryName 目录名称
     * @param string $displayDirPath 显示目录完整路径
     * @param int $rootDirectoryId 根目录ID
     */
    public static function createDisplayDirectoryEntity(
        string $userId,
        string $organizationCode,
        int $projectId,
        string $directoryName,
        string $displayDirPath,
        int $rootDirectoryId
    ): TaskFileEntity {
        $metadata = [
            'asr_display_directory' => true,
            'created_by' => 'asr_prepare_recording',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        return new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => 'directory',
            'file_name' => $directoryName,
            'file_extension' => '',
            'file_key' => $displayDirPath,
            'file_size' => 0,
            'external_url' => '',
            'storage_type' => 'workspace',
            'is_hidden' => false, // 非隐藏
            'is_directory' => true,
            'sort' => 0,
            'parent_id' => $rootDirectoryId,
            'source' => 2, // 2-项目目录
            'metadata' => Json::encode($metadata),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
