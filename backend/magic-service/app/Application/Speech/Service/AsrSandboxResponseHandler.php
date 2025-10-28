<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Codec\Json;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 沙箱响应处理服务
 * 负责处理沙箱 finish 接口的响应，更新文件和目录记录.
 */
readonly class AsrSandboxResponseHandler
{
    public function __construct(
        private TaskFileDomainService $taskFileDomainService,
        private ProjectDomainService $projectDomainService,
        private AsrDirectoryService $directoryService,
        private LoggerInterface $logger
    ) {
    }

    /**
     * 处理沙箱 finish 响应，更新文件和目录记录.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $sandboxResponse 沙箱响应数据（data 部分）
     * @param string $organizationCode 组织编码
     * @throws InvalidArgumentException
     */
    public function handleFinishResponse(
        AsrTaskStatusDTO $taskStatus,
        array $sandboxResponse,
        string $organizationCode
    ): void {
        $this->logger->info('开始处理沙箱 finish 响应', [
            'task_key' => $taskStatus->taskKey,
            'response_keys' => array_keys($sandboxResponse),
        ]);

        // 1. 提取文件信息
        $audioFile = $sandboxResponse['files']['audio_file'] ?? null;
        $noteFile = $sandboxResponse['files']['note_file'] ?? null;

        if ($audioFile === null) {
            $this->logger->warning('沙箱响应中未找到音频文件信息', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        // 2. 检查并处理目录重命名
        $this->handleDirectoryRename($taskStatus, $audioFile, $organizationCode);

        // 3. 创建音频文件记录
        $this->createAudioFile($taskStatus, $audioFile, $organizationCode);

        // 4. 更新笔记文件记录
        if ($noteFile !== null) {
            $this->updateNoteFile($taskStatus, $noteFile, $audioFile, $organizationCode);
        }

        $this->logger->info('沙箱 finish 响应处理完成', [
            'task_key' => $taskStatus->taskKey,
            'audio_file_id' => $taskStatus->audioFileId,
            'note_file_id' => $taskStatus->noteFileId,
            'display_directory' => $taskStatus->displayDirectory,
        ]);
    }

    /**
     * 处理目录重命名（如果目录名发生变化）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $audioFile 音频文件信息
     * @param string $organizationCode 组织编码
     */
    private function handleDirectoryRename(
        AsrTaskStatusDTO $taskStatus,
        array $audioFile,
        string $organizationCode
    ): void {
        $audioPath = $audioFile['path'] ?? '';
        if (empty($audioPath)) {
            return;
        }

        // 从音频路径提取实际的目录名
        $actualDirectory = dirname($audioPath);

        // 如果目录名没有变化，无需处理
        if ($taskStatus->displayDirectory === $actualDirectory) {
            $this->logger->debug('目录名未变化，无需更新', [
                'task_key' => $taskStatus->taskKey,
                'directory' => $actualDirectory,
            ]);
            return;
        }

        $this->logger->info('检测到目录重命名', [
            'task_key' => $taskStatus->taskKey,
            'old_directory' => $taskStatus->displayDirectory,
            'new_directory' => $actualDirectory,
        ]);

        $directoryId = $taskStatus->displayDirectoryId;
        if ($directoryId === null) {
            $this->logger->warning('目录ID为空，无法更新目录记录', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        try {
            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProject(
                (int) $taskStatus->projectId,
                $taskStatus->userId
            );
            $workDir = $projectEntity->getWorkDir();
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

            // 构建新旧完整路径
            $oldFullPath = AsrAssembler::buildFileKey($fullPrefix, $workDir, $taskStatus->displayDirectory);
            $newFullPath = AsrAssembler::buildFileKey($fullPrefix, $workDir, $actualDirectory);

            // 更新目录记录
            $dirEntity = $this->taskFileDomainService->getById($directoryId);
            if ($dirEntity !== null) {
                $dirEntity->setFileName(basename($actualDirectory));
                $dirEntity->setFileKey($newFullPath);
                $dirEntity->setUpdatedAt(date('Y-m-d H:i:s'));
                $this->taskFileDomainService->updateById($dirEntity);

                $this->logger->info('目录记录更新成功', [
                    'task_key' => $taskStatus->taskKey,
                    'directory_id' => $directoryId,
                    'old_file_key' => $oldFullPath,
                    'new_file_key' => $newFullPath,
                ]);
            }

            // 批量更新所有子文件的 file_key
            $this->batchUpdateChildrenFilePaths(
                (int) $taskStatus->projectId,
                $directoryId,
                $oldFullPath,
                $newFullPath,
                $taskStatus->taskKey
            );

            // 更新任务状态
            $taskStatus->displayDirectory = $actualDirectory;
        } catch (Throwable $e) {
            $this->logger->error('处理目录重命名失败', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.directory_rename_failed', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 批量更新目录下所有子文件的 file_key.
     *
     * @param int $projectId 项目ID
     * @param int $directoryId 目录ID
     * @param string $oldDirPath 旧目录完整路径
     * @param string $newDirPath 新目录完整路径
     * @param string $taskKey 任务键（用于日志）
     */
    private function batchUpdateChildrenFilePaths(
        int $projectId,
        int $directoryId,
        string $oldDirPath,
        string $newDirPath,
        string $taskKey
    ): void {
        // 确保目录路径以 / 结尾
        $oldDirPath = rtrim($oldDirPath, '/') . '/';
        $newDirPath = rtrim($newDirPath, '/') . '/';

        try {
            // 查询子文件
            $fileEntities = $this->taskFileDomainService->getChildrenByParentAndProject(
                $projectId,
                $directoryId
            );

            if (empty($fileEntities)) {
                $this->logger->info('目录下无子文件，无需更新路径', [
                    'task_key' => $taskKey,
                    'directory_id' => $directoryId,
                ]);
                return;
            }

            // 准备批量更新数据（使用公共方法避免代码重复）
            $result = $this->directoryService->buildFileKeyUpdateBatch($fileEntities, $oldDirPath, $newDirPath);
            $updateBatch = $result['updateBatch'];

            if (empty($updateBatch)) {
                $this->logger->info('无需更新任何文件路径', [
                    'task_key' => $taskKey,
                ]);
                return;
            }

            // 批量更新
            $updatedCount = $this->taskFileDomainService->batchUpdateFileKeys($updateBatch);

            $this->logger->info('批量更新子文件路径完成', [
                'task_key' => $taskKey,
                'directory_id' => $directoryId,
                'updated_count' => $updatedCount,
                'total_children' => count($fileEntities),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('批量更新子文件路径失败', [
                'task_key' => $taskKey,
                'directory_id' => $directoryId,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.batch_update_children_failed', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 创建音频文件记录.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $audioFile 音频文件信息
     * @param string $organizationCode 组织编码
     */
    private function createAudioFile(
        AsrTaskStatusDTO $taskStatus,
        array $audioFile,
        string $organizationCode
    ): void {
        $relativePath = $audioFile['path'] ?? '';
        $fileName = $audioFile['filename'] ?? '';
        $fileSize = $audioFile['size'] ?? 0;
        $duration = $audioFile['duration'] ?? null;

        if (empty($relativePath) || empty($fileName)) {
            $this->logger->warning('音频文件信息不完整，跳过创建', [
                'task_key' => $taskStatus->taskKey,
                'audio_file' => $audioFile,
            ]);
            return;
        }

        try {
            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProject(
                (int) $taskStatus->projectId,
                $taskStatus->userId
            );
            $workDir = $projectEntity->getWorkDir();
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

            // 构建完整 file_key
            $fileKey = AsrAssembler::buildFileKey($fullPrefix, $workDir, $relativePath);

            $this->logger->info('创建音频文件记录', [
                'task_key' => $taskStatus->taskKey,
                'file_name' => $fileName,
                'file_key' => $fileKey,
                'file_size' => $fileSize,
                'duration' => $duration,
            ]);

            // 构建 metadata
            $metadata = [
                'asr_task' => true,
                'created_by' => 'asr_sandbox_merge',
                'created_at' => date('Y-m-d H:i:s'),
                'sandbox_merge' => true,
                'source_path' => $relativePath,
            ];

            if ($duration !== null) {
                $metadata['duration'] = $duration;
            }

            // 创建文件实体
            $taskFileEntity = new TaskFileEntity([
                'user_id' => $taskStatus->userId,
                'organization_code' => $organizationCode,
                'project_id' => (int) $taskStatus->projectId,
                'topic_id' => 0,
                'task_id' => 0,
                'file_type' => 'user_upload',
                'file_name' => $fileName,
                'file_extension' => pathinfo($fileName, PATHINFO_EXTENSION),
                'file_key' => $fileKey,
                'file_size' => (int) $fileSize,
                'external_url' => '',
                'storage_type' => 'workspace',
                'is_hidden' => false,
                'is_directory' => false,
                'sort' => 0,
                'parent_id' => $taskStatus->displayDirectoryId,
                'source' => 2, // 2-项目目录
                'metadata' => Json::encode($metadata),
            ]);

            // 插入或忽略
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                $taskStatus->audioFileId = (string) $result->getFileId();
                $taskStatus->filePath = $relativePath;

                $this->logger->info('音频文件记录创建成功', [
                    'task_key' => $taskStatus->taskKey,
                    'audio_file_id' => $taskStatus->audioFileId,
                ]);
                return;
            }

            // 如果插入被忽略，查询现有记录
            $existingFile = $this->taskFileDomainService->getByProjectIdAndFileKey(
                (int) $taskStatus->projectId,
                $fileKey
            );
            if ($existingFile !== null) {
                $taskStatus->audioFileId = (string) $existingFile->getFileId();
                $taskStatus->filePath = $relativePath;

                $this->logger->info('音频文件记录已存在，使用现有记录', [
                    'task_key' => $taskStatus->taskKey,
                    'audio_file_id' => $taskStatus->audioFileId,
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('创建音频文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.create_audio_file_failed', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 更新笔记文件记录.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $noteFile 笔记文件信息
     * @param array $audioFile 音频文件信息（用于提取目录）
     * @param string $organizationCode 组织编码
     */
    private function updateNoteFile(
        AsrTaskStatusDTO $taskStatus,
        array $noteFile,
        array $audioFile,
        string $organizationCode
    ): void {
        $noteFileId = $taskStatus->presetNoteFileId;
        if (empty($noteFileId)) {
            $this->logger->debug('预设笔记文件ID为空，跳过更新', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        $noteFileName = $noteFile['filename'] ?? $noteFile['path'] ?? '';
        $noteFileSize = $noteFile['size'] ?? null;

        if (empty($noteFileName)) {
            $this->logger->warning('笔记文件名为空，跳过更新', [
                'task_key' => $taskStatus->taskKey,
                'note_file' => $noteFile,
            ]);
            return;
        }

        try {
            // 获取现有笔记文件记录
            $fileEntity = $this->taskFileDomainService->getById((int) $noteFileId);
            if ($fileEntity === null) {
                $this->logger->warning('预设笔记文件记录不存在', [
                    'task_key' => $taskStatus->taskKey,
                    'note_file_id' => $noteFileId,
                ]);
                return;
            }

            // 从音频路径提取目录
            $audioPath = $audioFile['path'] ?? '';
            if (empty($audioPath)) {
                $this->logger->warning('音频文件路径为空，无法提取目录', [
                    'task_key' => $taskStatus->taskKey,
                ]);
                return;
            }

            $directory = dirname($audioPath);

            // 拼接笔记文件的完整相对路径
            $noteRelativePath = $directory . '/' . $noteFileName;

            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProject(
                (int) $taskStatus->projectId,
                $taskStatus->userId
            );
            $workDir = $projectEntity->getWorkDir();
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

            // 构建新的 file_key
            $newFileKey = AsrAssembler::buildFileKey($fullPrefix, $workDir, $noteRelativePath);

            $this->logger->info('更新笔记文件记录', [
                'task_key' => $taskStatus->taskKey,
                'note_file_id' => $noteFileId,
                'old_file_name' => $fileEntity->getFileName(),
                'new_file_name' => $noteFileName,
                'old_file_key' => $fileEntity->getFileKey(),
                'new_file_key' => $newFileKey,
            ]);

            // 更新文件实体
            $fileEntity->setFileName($noteFileName);
            $fileEntity->setFileExtension(pathinfo($noteFileName, PATHINFO_EXTENSION));
            $fileEntity->setFileKey($newFileKey);

            if ($noteFileSize !== null) {
                $fileEntity->setFileSize((int) $noteFileSize);
            }

            $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));

            // 保存到数据库
            $this->taskFileDomainService->updateById($fileEntity);

            // 更新任务状态
            $taskStatus->noteFileId = $noteFileId;
            $taskStatus->noteFileName = $noteFileName;

            $this->logger->info('笔记文件记录更新完成', [
                'task_key' => $taskStatus->taskKey,
                'note_file_id' => $noteFileId,
                'new_file_key' => $newFileKey,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('更新笔记文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'note_file_id' => $noteFileId,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.update_note_file_failed', ['error' => $e->getMessage()]));
        }
    }
}
