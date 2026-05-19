<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Domain\Asr\Constants\AsrConfig;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Throwable;

/**
 * ASR 沙箱响应处理服务
 * 负责处理沙箱 finish 接口所在的响应，更新文件和目录记录.
 */
class AsrSandboxResponseHandler extends AbstractAppService
{
    use HasLogger;

    public function __construct(
        private AsrPresetFileService $presetFileService,
        private TaskFileDomainService $taskFileDomainService,
    ) {
    }

    /**
     * 处理沙箱 finish 响应，更新文件和目录记录.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $sandboxResponse 沙箱响应数据（data 部分）
     */
    public function handleFinishResponse(
        AsrTaskStatusDTO $taskStatus,
        array $sandboxResponse,
    ): void {
        $this->logger->info('开始处理沙箱 finish 响应', [
            'task_key' => $taskStatus->taskKey,
            'response_keys' => array_keys($sandboxResponse),
        ]);

        // 1. 提取文件信息
        $audioFile = $sandboxResponse['files']['audio_file'] ?? null;
        $noteFile = $sandboxResponse['files']['note_file'] ?? null;
        $markerFile = $sandboxResponse['files']['marker_file'] ?? null;

        if ($audioFile === null) {
            $this->logger->warning('沙箱响应中未找到音频文件信息', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        // 2. 检查并处理目录重命名（沙箱有bug，会重命名目录但是没有通知文件变动，没有改数据库记录）
        $taskStatus->displayDirectory = $this->extractDirectoryPath($audioFile);

        // 3. 查找音频文件记录
        $this->getAudioFileId($taskStatus, $audioFile);

        // 4. 处理笔记文件
        if ($noteFile !== null) {
            $noteAction = $noteFile['action_performed'] ?? null;
            $noteSize = isset($noteFile['size']) ? (int) $noteFile['size'] : null;
            $isDeletedAction = is_string($noteAction) && str_contains($noteAction, 'delete');
            $isEmptySize = $noteSize !== null && $noteSize === 0;
            if ($isDeletedAction || $isEmptySize) {
                $this->logger->info('沙箱标记笔记文件为空，跳过文件记录轮询', [
                    'task_key' => $taskStatus->taskKey,
                    'note_action' => $noteAction,
                    'note_size' => $noteSize,
                    'is_deleted_action' => $isDeletedAction,
                    'is_empty_size' => $isEmptySize,
                ]);
                $this->handleEmptyNoteFile($taskStatus);
                return;
            }
            // 在显示目录下按文件名定位最新的笔记文件 ID
            $this->getNoteFileId($taskStatus, $noteFile);
        } else {
            // 笔记文件为空或不存在，删除预设的笔记文件记录
            $this->handleEmptyNoteFile($taskStatus);
        }

        // 5. 处理标记文件
        if ($markerFile !== null) {
            $markerAction = $markerFile['action_performed'] ?? null;
            $markerSize = isset($markerFile['size']) ? (int) $markerFile['size'] : null;
            $isDeletedAction = is_string($markerAction) && str_contains($markerAction, 'delete');
            $isEmptySize = $markerSize !== null && $markerSize === 0;
            if ($isDeletedAction || $isEmptySize) {
                $this->logger->info('沙箱标记标记文件为空，删除文件记录', [
                    'task_key' => $taskStatus->taskKey,
                    'marker_action' => $markerAction,
                    'marker_size' => $markerSize,
                    'is_deleted_action' => $isDeletedAction,
                    'is_empty_size' => $isEmptySize,
                ]);
                $this->handleEmptyMarkerFile($taskStatus);
            } else {
                // 在隐藏目录下按文件名定位最新的标记文件 ID
                $this->getMarkerFileId($taskStatus, $markerFile);
            }
        } else {
            // 标记文件不存在，删除预设的标记文件记录
            $this->handleEmptyMarkerFile($taskStatus);
        }

        $this->logger->info('沙箱 finish 响应处理完成', [
            'task_key' => $taskStatus->taskKey,
            'audio_file_id' => $taskStatus->audioFileId,
            'note_file_id' => $taskStatus->noteFileId,
            'marker_file_id' => $taskStatus->markerFileId,
            'display_directory' => $taskStatus->displayDirectory,
        ]);
    }

    /**
     * 从文件路径提取目录路径.
     *
     * @param array $fileInfo 文件信息
     * @return string 目录路径（工作区相对路径）
     */
    private function extractDirectoryPath(array $fileInfo): string
    {
        $filePath = $fileInfo['path'] ?? '';
        if (empty($filePath)) {
            return '';
        }

        // 从文件路径提取实际的目录名
        return dirname($filePath);
    }

    /**
     * 根据响应的音频文件名/文件路径，找到音频文件 id，用于后续发聊天消息.
     * 使用轮询机制等待沙箱同步文件到数据库（最多等待 30 秒）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $audioFile 音频文件信息
     */
    private function getAudioFileId(
        AsrTaskStatusDTO $taskStatus,
        array $audioFile
    ): void {
        $relativePath = $audioFile['path'] ?? '';

        if (empty($relativePath)) {
            $this->logger->warning('音频文件路径为空，无法查询文件记录', [
                'task_key' => $taskStatus->taskKey,
                'audio_file' => $audioFile,
            ]);
            return;
        }

        try {
            // 沙箱合并完成的音频文件被写入到「显示目录」下（如 `录音纪要_xxx/录音.wav`），
            // 显示目录在 ASR 启动录音时已经创建并把 file_id 持久化到 Redis（displayDirectoryId）。
            // 因此这里直接拿 displayDirectoryId + 文件名定位即可，无需依赖 file_key 路径串。
            $fileEntity = $this->findFileWithPolling(
                taskStatus: $taskStatus,
                parentId: $taskStatus->displayDirectoryId,
                fileName: basename($relativePath),
                fileTypeName: '音频文件',
                relativePath: $relativePath,
            );

            if ($fileEntity !== null) {
                $taskStatus->audioFileId = (string) $fileEntity->getFileId();
                $taskStatus->filePath = $relativePath;
            }
        } catch (Throwable $e) {
            $this->logger->error('查询音频文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'relative_path' => $relativePath,
                'error' => $e->getMessage(),
            ]);

            // 如果是我们自己抛出的异常，直接重新抛出
            if ($e instanceof BusinessException) {
                throw $e;
            }

            ExceptionBuilder::throw(AsrErrorCode::CreateAudioFileFailed, '', ['error' => $e->getMessage()]);
        }
    }

    /**
     * 根据响应的笔记文件路径，找到笔记文件 id.
     * 使用轮询机制等待沙箱同步文件到数据库（最多等待 30 秒）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $noteFile 笔记文件信息
     */
    private function getNoteFileId(
        AsrTaskStatusDTO $taskStatus,
        array $noteFile
    ): void {
        $relativePath = $noteFile['path'] ?? '';

        if (empty($relativePath)) {
            $this->logger->warning('笔记文件路径为空，清空笔记文件ID', [
                'task_key' => $taskStatus->taskKey,
            ]);
            $taskStatus->noteFileId = null;
            $taskStatus->noteFileName = null;
            return;
        }

        try {
            // 笔记文件与音频文件同在「显示目录」下（如 `录音纪要_xxx/笔记.md`），
            // 直接用 displayDirectoryId + 文件名定位。
            $fileEntity = $this->findFileWithPolling(
                taskStatus: $taskStatus,
                parentId: $taskStatus->displayDirectoryId,
                fileName: basename($relativePath),
                fileTypeName: '笔记文件',
                relativePath: $relativePath,
                throwOnTimeout: false,
            );

            if ($fileEntity !== null) {
                $taskStatus->noteFileId = (string) $fileEntity->getFileId();
                $taskStatus->noteFileName = $noteFile['filename'] ?? $noteFile['path'] ?? '';

                $this->logger->info('成功找到笔记文件记录', [
                    'task_key' => $taskStatus->taskKey,
                    'note_file_id' => $taskStatus->noteFileId,
                    'note_file_name' => $taskStatus->noteFileName,
                    'old_preset_note_file_id' => $taskStatus->presetNoteFileId,
                ]);
            } else {
                // 没找到就清空，不使用预设ID
                $this->logger->warning('未找到笔记文件记录', [
                    'task_key' => $taskStatus->taskKey,
                    'relative_path' => $relativePath,
                ]);
                $taskStatus->noteFileId = null;
                $taskStatus->noteFileName = null;
            }
        } catch (Throwable $e) {
            // 笔记文件查询失败，清空笔记文件信息
            $this->logger->warning('查询笔记文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'relative_path' => $relativePath,
                'error' => $e->getMessage(),
            ]);
            $taskStatus->noteFileId = null;
            $taskStatus->noteFileName = null;
        }
    }

    /**
     * 在指定父目录下按文件名轮询查询文件记录.
     *
     * 设计要点：
     * - 沙箱合并/写入文件走 MagicFS API（POST /api/v1/open-api/magicfs/files），写入时
     *   `parent_id` 是真实父目录 file_id，`file_key` 是基于 file_id 的 opaque s3 key，
     *   不再带路径语义，因此**禁止**再用 `file_key` 字符串去查文件。
     * - ASR 在录音启动时已经创建了显示目录与隐藏目录，并把它们的 `file_id` 持久化到
     *   Redis（`displayDirectoryId` / `tempHiddenDirectoryId`）。调用方根据文件类型
     *   传入对应的 `$parentId`，本方法只负责按 (project_id, parent_id, file_name) 轮询。
     * - `$relativePath` 仅用于日志，便于排查；不再参与查询。
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param null|int $parentId 文件所在目录的 file_id（来自 ASR 自己创建目录时记录的 id）
     * @param string $fileName 文件名（取自沙箱响应路径的 basename）
     * @param string $fileTypeName 文件类型名称（用于日志）
     * @param string $relativePath 沙箱上报的工作区相对路径（仅用于日志）
     * @param bool $throwOnTimeout 超时是否抛出异常
     * @return null|TaskFileEntity 文件实体，未找到返回 null
     * @throws Throwable
     */
    private function findFileWithPolling(
        AsrTaskStatusDTO $taskStatus,
        ?int $parentId,
        string $fileName,
        string $fileTypeName,
        string $relativePath,
        bool $throwOnTimeout = true,
    ): ?TaskFileEntity {
        $logContext = [
            'task_key' => $taskStatus->taskKey,
            'file_type' => $fileTypeName,
            'project_id' => $taskStatus->projectId,
            'parent_id' => $parentId,
            'file_name' => $fileName,
            'relative_path' => $relativePath,
        ];

        // 1. 任务状态完整性 + 校验 ASR 自己已经把目标目录的 file_id 备好
        if (empty($taskStatus->projectId) || empty($taskStatus->userId) || empty($taskStatus->organizationCode)) {
            $this->logger->error('任务状态信息不完整，无法查询文件记录', $logContext + [
                'user_id' => $taskStatus->userId,
                'organization_code' => $taskStatus->organizationCode,
            ]);
            ExceptionBuilder::throw(AsrErrorCode::CreateAudioFileFailed, '', ['error' => '任务状态信息不完整']);
        }

        if ($parentId === null || $parentId <= 0 || $fileName === '') {
            $this->logger->warning(sprintf('%s 父目录或文件名缺失，跳过查询', $fileTypeName), $logContext);
            if ($throwOnTimeout) {
                ExceptionBuilder::throw(
                    AsrErrorCode::CreateAudioFileFailed,
                    '',
                    ['error' => sprintf('%s 父目录或文件名缺失', $fileTypeName)]
                );
            }
            return null;
        }

        // 2. 项目访问鉴权（保持原有行为）
        $this->getAccessibleProjectWithEditor(
            (int) $taskStatus->projectId,
            $taskStatus->userId,
            $taskStatus->organizationCode
        );

        // 3. 按 (project_id, parent_id, file_name) 轮询
        $this->logger->info(sprintf('开始轮询查询%s记录', $fileTypeName), $logContext + [
            'max_wait_seconds' => AsrConfig::FILE_RECORD_QUERY_TIMEOUT,
        ]);

        $timeoutSeconds = AsrConfig::FILE_RECORD_QUERY_TIMEOUT;
        $pollingInterval = AsrConfig::POLLING_INTERVAL;
        $startTime = microtime(true);
        $attempt = 0;

        while (true) {
            ++$attempt;
            $elapsedSeconds = (int) (microtime(true) - $startTime);

            $existingFile = $this->taskFileDomainService->getByProjectParentAndName(
                (int) $taskStatus->projectId,
                $parentId,
                $fileName
            );

            if ($existingFile !== null) {
                $this->logger->info(sprintf('成功找到%s记录', $fileTypeName), $logContext + [
                    'file_id' => $existingFile->getFileId(),
                    'attempt' => $attempt,
                    'elapsed_seconds' => $elapsedSeconds,
                ]);
                return $existingFile;
            }

            if ($elapsedSeconds >= $timeoutSeconds) {
                break;
            }

            if ($attempt % AsrConfig::FILE_RECORD_QUERY_LOG_FREQUENCY === 0 || $attempt === 1) {
                $this->logger->info(sprintf('等待沙箱同步%s到数据库', $fileTypeName), $logContext + [
                    'attempt' => $attempt,
                    'elapsed_seconds' => $elapsedSeconds,
                    'remaining_seconds' => max(0, $timeoutSeconds - $elapsedSeconds),
                ]);
            }

            sleep($pollingInterval);
        }

        // 4. 轮询超时
        $totalElapsedTime = (int) (microtime(true) - $startTime);
        $this->logger->warning(sprintf('轮询超时，未找到%s记录', $fileTypeName), $logContext + [
            'total_attempts' => $attempt,
            'total_elapsed_seconds' => $totalElapsedTime,
            'timeout_seconds' => $timeoutSeconds,
        ]);

        if ($throwOnTimeout) {
            ExceptionBuilder::throw(
                AsrErrorCode::CreateAudioFileFailed,
                '',
                ['error' => sprintf('等待 %d 秒后仍未找到%s记录', $timeoutSeconds, $fileTypeName)]
            );
        }

        return null;
    }

    /**
     * 处理空笔记文件（删除预设的笔记文件记录）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     */
    private function handleEmptyNoteFile(AsrTaskStatusDTO $taskStatus): void
    {
        $noteFileId = $taskStatus->presetNoteFileId;
        if (empty($noteFileId)) {
            $this->logger->debug('预设笔记文件ID为空，无需删除', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        $this->logger->info('笔记文件为空或不存在，删除预设笔记文件记录', [
            'task_key' => $taskStatus->taskKey,
            'note_file_id' => $noteFileId,
        ]);

        $deleted = $this->presetFileService->deleteNoteFile($noteFileId);
        if ($deleted) {
            // 清空任务状态中的笔记文件相关字段
            $taskStatus->presetNoteFileId = null;
            $taskStatus->presetNoteFilePath = null;
            $taskStatus->noteFileId = null;
            $taskStatus->noteFileName = null;

            $this->logger->info('空笔记文件处理完成', [
                'task_key' => $taskStatus->taskKey,
            ]);
        }
    }

    /**
     * 获取标记文件ID（通过沙箱响应的路径查找）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param array $markerFile 标记文件信息
     */
    private function getMarkerFileId(
        AsrTaskStatusDTO $taskStatus,
        array $markerFile
    ): void {
        $relativePath = $markerFile['path'] ?? '';

        if (empty($relativePath)) {
            $this->logger->warning('标记文件路径为空，清空标记文件ID', [
                'task_key' => $taskStatus->taskKey,
            ]);
            $taskStatus->markerFileId = null;
            $taskStatus->markerFileName = null;
            return;
        }

        try {
            // 标记文件与音频分片同在「隐藏目录」下（如 `.asr_recordings/session_xxx/marker.json`），
            // 直接用 tempHiddenDirectoryId + 文件名定位。
            $fileEntity = $this->findFileWithPolling(
                taskStatus: $taskStatus,
                parentId: $taskStatus->tempHiddenDirectoryId,
                fileName: basename($relativePath),
                fileTypeName: '标记文件',
                relativePath: $relativePath,
                throwOnTimeout: false,
            );

            if ($fileEntity !== null) {
                $taskStatus->markerFileId = (string) $fileEntity->getFileId();
                $taskStatus->markerFileName = $markerFile['filename'] ?? $markerFile['path'] ?? '';

                $this->logger->info('成功找到标记文件记录', [
                    'task_key' => $taskStatus->taskKey,
                    'marker_file_id' => $taskStatus->markerFileId,
                    'marker_file_name' => $taskStatus->markerFileName,
                    'old_preset_marker_file_id' => $taskStatus->presetMarkerFileId,
                ]);
            } else {
                // 没找到就清空，不使用预设ID
                $this->logger->warning('未找到标记文件记录', [
                    'task_key' => $taskStatus->taskKey,
                    'relative_path' => $relativePath,
                ]);
                $taskStatus->markerFileId = null;
                $taskStatus->markerFileName = null;
            }
        } catch (Throwable $e) {
            // 标记文件查询失败，清空标记文件信息
            $this->logger->warning('查询标记文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'relative_path' => $relativePath,
                'error' => $e->getMessage(),
            ]);
            $taskStatus->markerFileId = null;
            $taskStatus->markerFileName = null;
        }
    }

    /**
     * 处理空的标记文件（删除预设的标记文件记录）.
     */
    private function handleEmptyMarkerFile(AsrTaskStatusDTO $taskStatus): void
    {
        $markerFileId = $taskStatus->presetMarkerFileId;
        if (empty($markerFileId)) {
            $this->logger->debug('预设标记文件ID为空，无需删除', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        $this->logger->info('标记文件为空或不存在，删除预设标记文件记录', [
            'task_key' => $taskStatus->taskKey,
            'marker_file_id' => $markerFileId,
        ]);

        $deleted = $this->presetFileService->deleteMarkerFile($markerFileId);
        if ($deleted) {
            // 清空任务状态中的标记文件相关字段
            $taskStatus->presetMarkerFileId = null;
            $taskStatus->presetMarkerFilePath = null;
            $taskStatus->markerFileId = null;
            $taskStatus->markerFileName = null;

            $this->logger->info('空标记文件处理完成', [
                'task_key' => $taskStatus->taskKey,
            ]);
        }
    }
}
