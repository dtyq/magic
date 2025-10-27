<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrDirectoryAssembler;
use App\Application\Speech\DTO\AsrRecordingDirectoryDTO;
use App\Application\Speech\Enum\AsrDirectoryTypeEnum;
use App\Domain\Asr\Constants\AsrPaths;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Contract\TranslatorInterface;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 目录管理服务
 * 负责目录创建、查询、重命名和路径转换.
 */
readonly class AsrDirectoryService
{
    public function __construct(
        private ProjectDomainService $projectDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private TranslatorInterface $translator,
        private LoggerInterface $logger
    ) {
    }

    /**
     * 创建隐藏的临时录音目录（用于存放分片文件）.
     * 目录格式：.asr_recordings/{task_key}.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $taskKey 任务键
     * @return AsrRecordingDirectoryDTO 目录DTO
     * @throws InvalidArgumentException
     */
    public function createHiddenDirectory(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $taskKey
    ): AsrRecordingDirectoryDTO {
        try {
            // 1. 确保项目工作区根目录存在
            $rootDirectoryId = $this->ensureWorkspaceRootDirectoryExists($organizationCode, $projectId, $userId);

            // 2. 生成隐藏目录路径
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            $workDir = $projectEntity->getWorkDir();
            $relativePath = AsrPaths::getHiddenDirPath($taskKey);
            $hiddenDirPath = trim(sprintf('%s/%s', $workDir, $relativePath), '/');

            // 3. 检查目录是否已存在
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $hiddenDirPath);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    true,
                    AsrDirectoryTypeEnum::ASR_HIDDEN_DIR
                );
            }

            // 4. 创建隐藏目录实体
            $taskFileEntity = AsrDirectoryAssembler::createHiddenDirectoryEntity(
                $userId,
                $organizationCode,
                (int) $projectId,
                $relativePath,
                $hiddenDirPath,
                $rootDirectoryId,
                $taskKey
            );

            // 5. 插入或忽略
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $result->getFileId(),
                    true,
                    AsrDirectoryTypeEnum::ASR_HIDDEN_DIR
                );
            }

            // 6. 如果插入被忽略，查询现有目录
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $hiddenDirPath);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    true,
                    AsrDirectoryTypeEnum::ASR_HIDDEN_DIR
                );
            }

            throw new InvalidArgumentException(trans('asr.exception.create_hidden_directory_failed_project', ['projectId' => $projectId]));
        } catch (Throwable $e) {
            $this->logger->error('创建隐藏录音目录失败', [
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.create_hidden_directory_failed_error', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 创建显示的录音纪要目录（用于存放流式文本和笔记）.
     * 目录格式：录音纪要_Ymd_His（国际化）.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return AsrRecordingDirectoryDTO 目录DTO
     * @throws InvalidArgumentException
     */
    public function createDisplayDirectory(
        string $organizationCode,
        string $projectId,
        string $userId
    ): AsrRecordingDirectoryDTO {
        try {
            // 1. 确保项目工作区根目录存在
            $rootDirectoryId = $this->ensureWorkspaceRootDirectoryExists($organizationCode, $projectId, $userId);

            // 2. 生成显示目录名称
            $directoryName = $this->generateDirectoryName();
            $relativePath = $directoryName;

            // 3. 生成完整路径
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            $workDir = $projectEntity->getWorkDir();
            $displayDirPath = trim(sprintf('%s/%s', $workDir, $directoryName), '/');

            // 4. 创建显示目录实体
            $taskFileEntity = AsrDirectoryAssembler::createDisplayDirectoryEntity(
                $userId,
                $organizationCode,
                (int) $projectId,
                $directoryName,
                $displayDirPath,
                $rootDirectoryId
            );

            // 5. 插入或忽略
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $result->getFileId(),
                    false,
                    AsrDirectoryTypeEnum::ASR_DISPLAY_DIR
                );
            }

            // 6. 如果插入被忽略，查询现有目录
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $displayDirPath);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    false,
                    AsrDirectoryTypeEnum::ASR_DISPLAY_DIR
                );
            }

            throw new InvalidArgumentException(trans('asr.exception.create_display_directory_failed_project', ['projectId' => $projectId]));
        } catch (Throwable $e) {
            $this->logger->error('创建显示录音目录失败', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.create_display_directory_failed_error', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 重命名显示目录（使用智能标题）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能生成的标题
     * @param string $projectId 项目ID
     * @param AsrTitleGeneratorService $titleGenerator 标题生成器（用于清洗标题）
     * @return string 新的相对路径
     */
    public function renameDisplayDirectory(
        mixed $taskStatus,
        string $intelligentTitle,
        string $projectId,
        AsrTitleGeneratorService $titleGenerator
    ): string {
        // 1. 获取原显示目录信息
        $relativeOldPath = $taskStatus->displayDirectory;
        $oldDirectoryId = $taskStatus->displayDirectoryId;

        if (empty($relativeOldPath) || $oldDirectoryId === null) {
            $this->logger->warning('显示目录信息不完整，跳过重命名', [
                'task_key' => $taskStatus->taskKey,
                'old_path' => $relativeOldPath,
                'old_id' => $oldDirectoryId,
            ]);
            return $relativeOldPath;
        }

        // 2. 提取时间戳
        $oldDirectoryName = basename($relativeOldPath);
        $timestamp = $this->extractTimestamp($oldDirectoryName, $taskStatus->taskKey);

        // 3. 清洗并构建新目录名
        $safeTitle = $titleGenerator->sanitizeTitle($intelligentTitle);
        if (empty($safeTitle)) {
            $this->logger->warning('智能标题为空，跳过重命名', [
                'task_key' => $taskStatus->taskKey,
                'intelligent_title' => $intelligentTitle,
            ]);
            return $relativeOldPath;
        }

        $newDirectoryName = $safeTitle . $timestamp;
        $newRelativePath = $newDirectoryName;

        // 3.1 冲突检测：如果新路径已存在，追加短哈希后缀保证唯一
        $fullNewPath = $this->getFullPath($projectId, $taskStatus->userId, $newRelativePath);
        $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $fullNewPath);
        if ($existingDir !== null) {
            $shortHash = substr(md5($taskStatus->taskKey), 0, 6);
            $newDirectoryName = sprintf('%s-%s', $newDirectoryName, $shortHash);
            $newRelativePath = $newDirectoryName;
            $fullNewPath = $this->getFullPath($projectId, $taskStatus->userId, $newRelativePath);
        }

        // 如果新旧路径相同，无需重命名
        if ($newRelativePath === $relativeOldPath) {
            $this->logger->info('新旧目录路径相同，无需重命名', [
                'task_key' => $taskStatus->taskKey,
                'directory_path' => $newRelativePath,
            ]);
            return $relativeOldPath;
        }

        // 4. 构建完整路径并更新数据库
        $fullOldPath = $this->getFullPath($projectId, $taskStatus->userId, $relativeOldPath);

        try {
            $dirEntity = $this->taskFileDomainService->getById($oldDirectoryId);
            if ($dirEntity === null) {
                $this->logger->error('目录记录不存在', [
                    'task_key' => $taskStatus->taskKey,
                    'directory_id' => $oldDirectoryId,
                ]);
                return $relativeOldPath;
            }

            $dirEntity->setFileName($newDirectoryName);
            $dirEntity->setFileKey($fullNewPath);
            $dirEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileDomainService->updateById($dirEntity);

            // 更新目录下所有子文件的 file_key 路径
            $updatedCount = $this->updateChildrenFilePaths(
                (int) $projectId,
                $oldDirectoryId,
                $fullOldPath,
                $fullNewPath,
                $taskStatus->taskKey
            );

            $this->logger->info('显示目录重命名成功', [
                'task_key' => $taskStatus->taskKey,
                'old_relative_path' => $relativeOldPath,
                'new_relative_path' => $newRelativePath,
                'old_full_path' => $fullOldPath,
                'new_full_path' => $fullNewPath,
                'intelligent_title' => $intelligentTitle,
                'directory_id' => $oldDirectoryId,
                'children_updated' => $updatedCount,
            ]);

            return $newRelativePath;
        } catch (Throwable $e) {
            $this->logger->error('重命名显示目录失败', [
                'task_key' => $taskStatus->taskKey,
                'old_path' => $relativeOldPath,
                'new_path' => $newRelativePath,
                'error' => $e->getMessage(),
            ]);
            return $relativeOldPath;
        }
    }

    /**
     * 将相对路径转换为完整路径.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $relativePath 相对路径
     * @return string 完整路径
     */
    public function getFullPath(string $projectId, string $userId, string $relativePath): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();
        return trim(sprintf('%s/%s', $workDir, $relativePath), '/');
    }

    /**
     * 获取项目的 workspace 路径.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return string workspace 路径
     */
    public function getWorkspacePath(string $projectId, string $userId): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        return rtrim($projectEntity->getWorkDir(), '/') . '/';
    }

    /**
     * 生成 ASR 目录名.
     *
     * @return string 目录名
     */
    private function generateDirectoryName(): string
    {
        $base = $this->translator->trans('asr.directory.recordings_summary_folder');
        return sprintf('%s_%s', $base, date('Ymd_His'));
    }

    /**
     * 从目录名提取时间戳.
     *
     * @param string $directoryName 目录名
     * @param string $taskKey 任务键（用于日志）
     * @return string 时间戳（格式：_20251026_210626）
     */
    private function extractTimestamp(string $directoryName, string $taskKey): string
    {
        if (preg_match('/_(\d{8}_\d{6})$/', $directoryName, $matches)) {
            return '_' . $matches[1];
        }

        // 如果没有匹配到时间戳，使用当前时间
        $this->logger->info('未找到原时间戳，使用当前时间', [
            'task_key' => $taskKey,
            'old_directory_name' => $directoryName,
        ]);
        return '_' . date('Ymd_His');
    }

    /**
     * 确保工作区根目录存在.
     *
     * @param string $organizationCode 组织代码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return int 项目工作区根目录的 file_id
     * @throws InvalidArgumentException
     */
    private function ensureWorkspaceRootDirectoryExists(string $organizationCode, string $projectId, string $userId): int
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            throw new InvalidArgumentException(trans('asr.exception.workspace_directory_empty', ['projectId' => $projectId]));
        }

        return $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            (int) $projectId,
            $workDir,
            $userId,
            $organizationCode
        );
    }

    /**
     * 更新目录下所有子文件和子目录的 file_key 路径.
     *
     * @param int $projectId 项目ID
     * @param int $oldDirectoryId 旧目录ID（用于查询子文件）
     * @param string $oldDirPath 旧目录完整路径（末尾带 /）
     * @param string $newDirPath 新目录完整路径（末尾带 /）
     * @param string $taskKey 任务键（用于日志）
     * @return int 更新的文件数量
     */
    private function updateChildrenFilePaths(
        int $projectId,
        int $oldDirectoryId,
        string $oldDirPath,
        string $newDirPath,
        string $taskKey
    ): int {
        // 确保目录路径以 / 结尾
        $oldDirPath = rtrim($oldDirPath, '/') . '/';
        $newDirPath = rtrim($newDirPath, '/') . '/';

        try {
            // 1. 使用 parent_id 查询子文件（利用现有索引 idx_project_parent_sort）
            $fileEntities = $this->taskFileDomainService->getChildrenByParentAndProject(
                $projectId,
                $oldDirectoryId
            );

            if (empty($fileEntities)) {
                $this->logger->info('目录下无子文件，无需更新路径', [
                    'task_key' => $taskKey,
                    'old_dir_path' => $oldDirPath,
                ]);
                return 0;
            }

            // 2. 准备批量更新数据
            $updateBatch = [];
            $now = date('Y-m-d H:i:s');

            foreach ($fileEntities as $fileEntity) {
                $oldFileKey = $fileEntity->getFileKey();

                // 计算新的 file_key（替换目录路径部分）
                $newFileKey = str_replace($oldDirPath, $newDirPath, $oldFileKey);

                if ($newFileKey === $oldFileKey) {
                    continue; // 路径未改变，跳过
                }

                $updateBatch[] = [
                    'file_id' => $fileEntity->getFileId(),
                    'file_key' => $newFileKey,
                    'updated_at' => $now,
                ];
            }

            if (empty($updateBatch)) {
                $this->logger->info('无需更新任何文件路径', [
                    'task_key' => $taskKey,
                ]);
                return 0;
            }

            // 3. 批量更新
            $updatedCount = $this->taskFileDomainService->batchUpdateFileKeys($updateBatch);

            $this->logger->info('批量更新子文件路径完成', [
                'task_key' => $taskKey,
                'old_dir_path' => $oldDirPath,
                'new_dir_path' => $newDirPath,
                'total_files' => count($fileEntities),
                'updated_count' => $updatedCount,
            ]);

            return $updatedCount;
        } catch (Throwable $e) {
            $this->logger->error('更新子文件路径失败', [
                'task_key' => $taskKey,
                'old_dir_path' => $oldDirPath,
                'new_dir_path' => $newDirPath,
                'error' => $e->getMessage(),
            ]);
            // 不抛出异常，避免影响主流程
            return 0;
        }
    }
}
