<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Domain\Asr\Constants\AsrConfig;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 沙箱响应处理服务
 * 负责处理沙箱 finish 接口的响应，更新文件和目录记录.
 */
readonly class AsrSandboxResponseHandler
{
    public function __construct(
        private AsrPresetFileService $presetFileService,
        private TaskFileDomainService $taskFileDomainService,
        private ProjectDomainService $projectDomainService,
        private LoggerInterface $logger
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

        if ($audioFile === null) {
            $this->logger->warning('沙箱响应中未找到音频文件信息', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return;
        }

        // 2. 检查并处理目录重命名（沙箱有bug，会重命名目录但是没有通知文件变动，没有改数据库记录）
        $taskStatus->displayDirectory = $this->getAudioDirectoryPath($audioFile);

        // 3. 查找音频文件记录
        $this->getAudioFileId($taskStatus, $audioFile);

        // 4. 处理笔记文件
        if ($noteFile !== null) {
            // 更新任务状态
            $taskStatus->noteFileId = $taskStatus->presetNoteFileId;
            $taskStatus->noteFileName = $noteFile['filename'] ?? $noteFile['path'] ?? '';
        } else {
            // 笔记文件为空或不存在，删除预设的笔记文件记录
            $this->handleEmptyNoteFile($taskStatus);
        }

        $this->logger->info('沙箱 finish 响应处理完成', [
            'task_key' => $taskStatus->taskKey,
            'audio_file_id' => $taskStatus->audioFileId,
            'note_file_id' => $taskStatus->noteFileId,
            'display_directory' => $taskStatus->displayDirectory,
        ]);
    }

    /**
     * 从音频文件路径提取目录路径.
     *
     * @param array $audioFile 音频文件信息
     * @return string 目录路径（工作区相对路径）
     */
    private function getAudioDirectoryPath(array $audioFile): string
    {
        $audioPath = $audioFile['path'] ?? '';
        if (empty($audioPath)) {
            return '';
        }

        // 从音频路径提取实际的目录名
        return dirname($audioPath);
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
        $fileName = $audioFile['filename'] ?? '';

        if (empty($relativePath)) {
            $this->logger->warning('音频文件路径为空，无法查询文件记录', [
                'task_key' => $taskStatus->taskKey,
                'audio_file' => $audioFile,
            ]);
            return;
        }

        // 检查必要的任务状态字段
        if (empty($taskStatus->projectId) || empty($taskStatus->userId) || empty($taskStatus->organizationCode)) {
            $this->logger->error('任务状态信息不完整，无法查询文件记录', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'user_id' => $taskStatus->userId,
                'organization_code' => $taskStatus->organizationCode,
            ]);
            ExceptionBuilder::throw(AsrErrorCode::CreateAudioFileFailed, '', ['error' => '任务状态信息不完整']);
        }

        try {
            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProject(
                (int) $taskStatus->projectId,
                $taskStatus->userId
            );
            $workDir = $projectEntity->getWorkDir();
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($taskStatus->organizationCode);

            // 构建完整 file_key
            $fileKey = AsrAssembler::buildFileKey($fullPrefix, $workDir, $relativePath);

            $this->logger->info('开始轮询查询音频文件记录', [
                'task_key' => $taskStatus->taskKey,
                'file_name' => $fileName,
                'relative_path' => $relativePath,
                'file_key' => $fileKey,
                'project_id' => $taskStatus->projectId,
                'max_wait_seconds' => AsrConfig::FILE_RECORD_QUERY_TIMEOUT,
            ]);

            // 轮询查询文件记录
            $timeoutSeconds = AsrConfig::FILE_RECORD_QUERY_TIMEOUT;
            $pollingInterval = AsrConfig::POLLING_INTERVAL;
            $startTime = microtime(true);
            $attempt = 0;

            while (true) {
                ++$attempt;
                $elapsedSeconds = (int) (microtime(true) - $startTime);

                // 查询文件记录
                $existingFile = $this->taskFileDomainService->getByProjectIdAndFileKey(
                    (int) $taskStatus->projectId,
                    $fileKey
                );

                if ($existingFile !== null) {
                    // 找到文件记录，更新任务状态
                    $taskStatus->audioFileId = (string) $existingFile->getFileId();
                    $taskStatus->filePath = $relativePath;

                    $this->logger->info('成功找到音频文件记录', [
                        'task_key' => $taskStatus->taskKey,
                        'audio_file_id' => $taskStatus->audioFileId,
                        'file_name' => $existingFile->getFileName(),
                        'file_path' => $relativePath,
                        'file_key' => $fileKey,
                        'attempt' => $attempt,
                        'elapsed_seconds' => $elapsedSeconds,
                    ]);
                    return;
                }

                // 检查是否超时
                if ($elapsedSeconds >= $timeoutSeconds) {
                    break;
                }

                // 记录轮询进度
                if ($attempt % AsrConfig::FILE_RECORD_QUERY_LOG_FREQUENCY === 0 || $attempt === 1) {
                    $remainingSeconds = max(0, $timeoutSeconds - $elapsedSeconds);
                    $this->logger->info('等待沙箱同步音频文件到数据库', [
                        'task_key' => $taskStatus->taskKey,
                        'file_key' => $fileKey,
                        'attempt' => $attempt,
                        'elapsed_seconds' => $elapsedSeconds,
                        'remaining_seconds' => $remainingSeconds,
                    ]);
                }

                // 等待下一次轮询
                sleep($pollingInterval);
            }

            // 轮询超时，仍未找到文件记录
            $totalElapsedTime = (int) (microtime(true) - $startTime);
            $this->logger->warning('轮询超时，未找到音频文件记录', [
                'task_key' => $taskStatus->taskKey,
                'file_key' => $fileKey,
                'relative_path' => $relativePath,
                'project_id' => $taskStatus->projectId,
                'total_attempts' => $attempt,
                'total_elapsed_seconds' => $totalElapsedTime,
                'timeout_seconds' => $timeoutSeconds,
            ]);

            // 抛出异常，因为没有找到音频文件记录会导致后续聊天消息发送失败
            ExceptionBuilder::throw(
                AsrErrorCode::CreateAudioFileFailed,
                '',
                ['error' => sprintf('等待 %d 秒后仍未找到音频文件记录', $timeoutSeconds)]
            );
        } catch (Throwable $e) {
            $this->logger->error('查询音频文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'relative_path' => $relativePath,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // 如果是我们自己抛出的异常，直接重新抛出
            if ($e instanceof BusinessException) {
                throw $e;
            }

            ExceptionBuilder::throw(AsrErrorCode::CreateAudioFileFailed, '', ['error' => $e->getMessage()]);
        }
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
}
