<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\ChatMessageAssembler;
use App\Application\Speech\DTO\AsrSandboxMergeResultDTO;
use App\Application\Speech\DTO\NoteDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Codec\Json;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 沙箱服务
 * 负责沙箱任务启动、合并、轮询和文件记录创建.
 */
readonly class AsrSandboxService
{
    public function __construct(
        private SandboxGatewayInterface $sandboxGateway,
        private AsrRecorderInterface $asrRecorder,
        private TaskFileDomainService $taskFileDomainService,
        private ChatMessageAssembler $chatMessageAssembler,
        private ProjectDomainService $projectDomainService,
        private LoggerInterface $logger
    ) {
    }

    /**
     * 启动录音任务.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @throws InvalidArgumentException
     */
    public function startRecordingTask(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): void {
        // 生成沙箱ID
        $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
            $taskStatus->projectId . '_asr_recording',
            12
        );
        $taskStatus->sandboxId = $sandboxId;

        // 设置用户上下文
        $this->sandboxGateway->setUserContext($userId, $organizationCode);

        // 确保沙箱可用
        $actualSandboxId = $this->sandboxGateway->ensureSandboxAvailable(
            $sandboxId,
            $taskStatus->projectId,
            ''
        );

        $this->logger->info('ASR 录音：沙箱已就绪', [
            'task_key' => $taskStatus->taskKey,
            'requested_sandbox_id' => $sandboxId,
            'actual_sandbox_id' => $actualSandboxId,
        ]);

        // 调用沙箱启动任务（需要完整路径）
        $fullHiddenPath = $this->getFullPath(
            $taskStatus->projectId,
            $userId,
            $taskStatus->tempHiddenDirectory
        );

        $response = $this->asrRecorder->startTask(
            $actualSandboxId,
            $taskStatus->taskKey,
            $fullHiddenPath
        );

        if (! $response->isSuccess()) {
            throw new InvalidArgumentException(trans('asr.exception.sandbox_task_creation_failed', ['message' => $response->getMessage()]));
        }

        $taskStatus->sandboxTaskCreated = true;

        $this->logger->info('ASR 录音：沙箱任务已创建', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'status' => $response->getStatus(),
        ]);
    }

    /**
     * 合并音频文件.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名）
     * @param string $organizationCode 组织编码
     * @return AsrSandboxMergeResultDTO 合并结果
     * @throws InvalidArgumentException
     */
    public function mergeAudioFiles(
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle,
        string $organizationCode
    ): AsrSandboxMergeResultDTO {
        $this->logger->info('开始沙箱音频处理流程', [
            'task_key' => $taskStatus->taskKey,
            'project_id' => $taskStatus->projectId,
            'hidden_directory' => $taskStatus->tempHiddenDirectory,
            'display_directory' => $taskStatus->displayDirectory,
        ]);

        // 准备沙箱ID
        if (empty($taskStatus->sandboxId)) {
            $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
                $taskStatus->projectId . '_asr_recording',
                12
            );
            $taskStatus->sandboxId = $sandboxId;
        }

        // 调用沙箱 finish 并轮询等待完成
        $mergeResult = $this->callSandboxFinishAndWait($taskStatus, $fileTitle);

        // 从沙箱返回的文件路径中提取实际的文件名
        $actualFileName = basename($mergeResult->filePath);

        $this->logger->info('沙箱返回的文件信息', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_file_path' => $mergeResult->filePath,
            'actual_file_name' => $actualFileName,
            'input_file_title' => $fileTitle,
        ]);

        // 创建文件记录
        $audioFileEntity = $this->createFileRecord(
            $taskStatus,
            $mergeResult,
            $actualFileName,
            $organizationCode
        );

        // 更新任务状态
        $taskStatus->audioFileId = (string) $audioFileEntity->getFileId();
        $taskStatus->filePath = $this->chatMessageAssembler->extractWorkspaceRelativePath(
            $audioFileEntity->getFileKey()
        );
        $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);

        $this->logger->info('沙箱音频处理完成', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'file_id' => $taskStatus->audioFileId,
            'file_path' => $taskStatus->filePath,
        ]);

        return $mergeResult;
    }

    /**
     * 创建文件记录.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param AsrSandboxMergeResultDTO $mergeResult 沙箱合并结果
     * @param string $fileName 文件名
     * @param string $organizationCode 组织编码
     * @return TaskFileEntity 文件实体
     * @throws InvalidArgumentException
     */
    public function createFileRecord(
        AsrTaskStatusDTO $taskStatus,
        AsrSandboxMergeResultDTO $mergeResult,
        string $fileName,
        string $organizationCode
    ): TaskFileEntity {
        // 验证必要信息
        $displayDirectoryId = $taskStatus->displayDirectoryId;
        if ($displayDirectoryId === null) {
            throw new InvalidArgumentException(trans('asr.exception.display_directory_id_not_exist'));
        }

        $relativeDisplayDir = $taskStatus->displayDirectory;
        if (empty($relativeDisplayDir)) {
            throw new InvalidArgumentException(trans('asr.exception.display_directory_path_not_exist'));
        }

        $userId = $taskStatus->userId;
        $projectId = $taskStatus->projectId;

        // 构建文件路径
        $fullDisplayPath = $this->getFullPath($projectId, $userId, $relativeDisplayDir);
        $fileKey = rtrim($fullDisplayPath, '/') . '/' . $fileName;

        $this->logger->info('创建沙箱音频文件记录', [
            'task_key' => $taskStatus->taskKey,
            'source_path' => $mergeResult->filePath,
            'target_path' => $fileKey,
            'parent_id' => $displayDirectoryId,
            'duration' => $mergeResult->duration,
            'file_size' => $mergeResult->fileSize,
        ]);

        // 创建文件实体
        $metadata = [
            'asr_task' => true,
            'created_by' => 'asr_sandbox_summary',
            'created_at' => date('Y-m-d H:i:s'),
            'sandbox_merge' => true,
            'source_file' => $mergeResult->filePath,
        ];

        if ($mergeResult->duration !== null) {
            $metadata['duration'] = $mergeResult->duration;
        }

        $taskFileEntity = new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => (int) $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => 'user_upload',
            'file_name' => $fileName,
            'file_extension' => pathinfo($fileName, PATHINFO_EXTENSION),
            'file_key' => $fileKey,
            'file_size' => $mergeResult->fileSize ?? 0,
            'external_url' => '',
            'storage_type' => 'workspace',
            'is_hidden' => false,
            'is_directory' => false,
            'sort' => 0,
            'parent_id' => $displayDirectoryId,
            'source' => 2, // 2-项目目录
            'metadata' => Json::encode($metadata),
        ]);

        try {
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return $result;
            }

            // 如果插入被忽略，查询现有记录
            $existingFile = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $fileKey);
            if ($existingFile !== null) {
                $this->logger->info('文件记录已存在，使用现有记录', [
                    'task_key' => $taskStatus->taskKey,
                    'file_id' => $existingFile->getFileId(),
                    'file_key' => $fileKey,
                ]);
                return $existingFile;
            }

            throw new InvalidArgumentException(trans('asr.exception.create_file_record_failed_no_query'));
        } catch (Throwable $e) {
            $this->logger->error('创建沙箱音频文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(trans('asr.exception.create_file_record_failed_error', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 调用沙箱 finish 并轮询等待完成.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名）
     * @return AsrSandboxMergeResultDTO 合并结果
     * @throws InvalidArgumentException
     */
    private function callSandboxFinishAndWait(
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle
    ): AsrSandboxMergeResultDTO {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            throw new InvalidArgumentException(trans('asr.exception.sandbox_id_not_exist'));
        }

        // 准备笔记信息
        $noteFilename = null;
        $noteContent = null;
        if (! empty($taskStatus->noteContent)) {
            $noteDTO = new NoteDTO(
                $taskStatus->noteContent,
                $taskStatus->noteFileType ?? 'md'
            );
            $noteFilename = $noteDTO->generateFileName($fileTitle);
            $noteContent = $taskStatus->noteContent;

            $this->logger->info('准备传递笔记到沙箱', [
                'task_key' => $taskStatus->taskKey,
                'audio_title' => $fileTitle,
                'note_filename' => $noteFilename,
                'note_length' => mb_strlen($noteContent),
            ]);
        }

        // 获取完整路径
        $fullDisplayPath = $this->getFullPath(
            $taskStatus->projectId,
            $taskStatus->userId,
            $taskStatus->displayDirectory
        );
        $fullHiddenPath = $this->getFullPath(
            $taskStatus->projectId,
            $taskStatus->userId,
            $taskStatus->tempHiddenDirectory
        );

        // 首次调用 finish
        $response = $this->asrRecorder->finishTask(
            $sandboxId,
            $taskStatus->taskKey,
            $fullDisplayPath,
            $fileTitle,
            $fullHiddenPath,
            '.workspace',
            $noteFilename,
            $noteContent
        );

        // 轮询等待完成
        $maxAttempts = 60;
        $interval = 1;

        for ($attempt = 1; $attempt <= $maxAttempts; ++$attempt) {
            $status = $response->getStatus();

            if ($status === 'finished') {
                $this->logger->info('沙箱音频合并完成', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'file_path' => $response->getFilePath(),
                ]);

                return AsrSandboxMergeResultDTO::fromSandboxResponse([
                    'status' => 'finished',
                    'file_path' => $response->getFilePath(),
                    'duration' => $response->getDuration(),
                    'file_size' => $response->getFileSize(),
                ]);
            }

            if ($status === 'error') {
                throw new InvalidArgumentException(trans('asr.exception.sandbox_merge_failed', ['message' => $response->getErrorMessage()]));
            }

            // 记录进度
            if ($attempt % 10 === 0) {
                $this->logger->info('等待沙箱音频合并', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'status' => $status,
                ]);
            }

            sleep($interval);

            // 继续轮询
            $response = $this->asrRecorder->finishTask(
                $sandboxId,
                $taskStatus->taskKey,
                $fullDisplayPath,
                $fileTitle,
                $fullHiddenPath,
                '.workspace',
                $noteFilename,
                $noteContent
            );
        }

        throw new InvalidArgumentException(trans('asr.exception.sandbox_merge_timeout'));
    }

    /**
     * 将相对路径转换为完整路径.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $relativePath 相对路径
     * @return string 完整路径
     */
    private function getFullPath(string $projectId, string $userId, string $relativePath): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();
        return trim(sprintf('%s/%s', $workDir, $relativePath), '/');
    }
}
