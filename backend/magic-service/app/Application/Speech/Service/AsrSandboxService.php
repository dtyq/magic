<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\DTO\AsrSandboxMergeResultDTO;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Enum\SandboxAsrStatusEnum;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

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
        private AsrSandboxResponseHandler $responseHandler,
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

        // 调用沙箱启动任务
        // 注意：沙箱 API 只接受工作区相对路径 (如: .asr_recordings/session_xxx)
        $response = $this->asrRecorder->startTask(
            $actualSandboxId,
            $taskStatus->taskKey,
            $taskStatus->tempHiddenDirectory  // 如: .asr_recordings/session_xxx
        );

        if (! $response->isSuccess()) {
            throw new InvalidArgumentException(trans('asr.exception.sandbox_task_creation_failed', ['message' => $response->message]));
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

        // 调用沙箱 finish 并轮询等待完成（会通过响应处理器自动创建/更新文件记录）
        $mergeResult = $this->callSandboxFinishAndWait($taskStatus, $fileTitle, $organizationCode);

        $this->logger->info('沙箱返回的文件信息', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_file_path' => $mergeResult->filePath,
            'audio_file_id' => $taskStatus->audioFileId,
            'note_file_id' => $taskStatus->noteFileId,
        ]);

        // 更新任务状态（文件记录已由响应处理器创建）
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
     * 调用沙箱 finish 并轮询等待完成.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能标题（用于重命名）
     * @param string $organizationCode 组织编码
     * @return AsrSandboxMergeResultDTO 合并结果
     * @throws InvalidArgumentException
     */
    private function callSandboxFinishAndWait(
        AsrTaskStatusDTO $taskStatus,
        string $intelligentTitle,
        string $organizationCode
    ): AsrSandboxMergeResultDTO {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            throw new InvalidArgumentException(trans('asr.exception.sandbox_id_not_exist'));
        }

        // 构建音频配置对象 (V2 结构化版本)
        $audioConfig = new AsrAudioConfig(
            sourceDir: $taskStatus->tempHiddenDirectory,  // 如: .asr_recordings/session_xxx
            targetDir: $taskStatus->displayDirectory,     // 如: 录音总结_20251027_230949
            outputFilename: $intelligentTitle              // 如: 被讨厌的勇气
        );

        // 构建笔记文件配置对象
        $noteFileConfig = null;
        if (! empty($taskStatus->presetNoteFilePath)) {
            $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetNoteFilePath);
            $noteFilename = basename($workspaceRelativePath);
            $noteFileConfig = new AsrNoteFileConfig(
                sourcePath: $workspaceRelativePath,  // 如: 录音总结_20251027_230949/笔记.md
                targetPath: rtrim($taskStatus->displayDirectory, '/') . '/' . $intelligentTitle . '-' . $noteFilename // 如: 录音总结_20251027_230949/被讨厌的勇气-笔记.md
            );
        }

        // 构建流式识别文件配置对象 (直接删除)
        $transcriptFileConfig = null;
        if (! empty($taskStatus->presetTranscriptFilePath)) {
            $transcriptWorkspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetTranscriptFilePath);
            $transcriptFileConfig = new AsrTranscriptFileConfig(
                sourcePath: $transcriptWorkspaceRelativePath  // 如: .asr_recordings/task_2/流式识别.md
            );
        }

        $this->logger->info('准备调用沙箱 finish (V2)', [
            'task_key' => $taskStatus->taskKey,
            'intelligent_title' => $intelligentTitle,
            'audio_config' => $audioConfig->toArray(),
            'note_file_config' => $noteFileConfig?->toArray(),
            'transcript_file_config' => $transcriptFileConfig?->toArray(),
        ]);

        // 首次调用 finish (V2 结构化版本)
        $response = $this->asrRecorder->finishTask(
            $sandboxId,
            $taskStatus->taskKey,
            '.workspace',
            $audioConfig,
            $noteFileConfig,
            $transcriptFileConfig
        );

        // 轮询等待完成
        $maxAttempts = 60;
        $interval = 1;

        for ($attempt = 1; $attempt <= $maxAttempts; ++$attempt) {
            $statusString = $response->getStatus();
            $status = SandboxAsrStatusEnum::fromString($statusString);

            // 检查是否为完成状态（包含 completed 和 finished）
            if ($status?->isCompleted()) {
                $this->logger->info('沙箱音频合并完成 (V2)', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'status' => $status->value,
                    'file_path' => $response->getFilePath(),
                ]);

                // 处理沙箱响应，更新文件和目录记录
                $responseData = $response->getData();
                $this->responseHandler->handleFinishResponse(
                    $taskStatus,
                    $responseData,
                    $organizationCode
                );

                return AsrSandboxMergeResultDTO::fromSandboxResponse([
                    'status' => $status->value,
                    'file_path' => $response->getFilePath(),
                    'duration' => $response->getDuration(),
                    'file_size' => $response->getFileSize(),
                ]);
            }

            // 检查是否为错误状态
            if ($status?->isError()) {
                throw new InvalidArgumentException(trans('asr.exception.sandbox_merge_failed', ['message' => $response->getErrorMessage()]));
            }

            // 中间状态（waiting, running, finalizing）：继续轮询
            // 使用枚举判断，符合沙箱 SandboxAsrStatusEnum 定义

            // 记录进度
            if ($attempt % 10 === 0) {
                $this->logger->info('等待沙箱音频合并', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'status' => $status->value ?? $statusString,
                    'status_description' => $status?->getDescription(),
                ]);
            }

            sleep($interval);

            // 继续轮询（V2 结构化版本）
            $response = $this->asrRecorder->finishTask(
                $sandboxId,
                $taskStatus->taskKey,
                '.workspace',
                $audioConfig,
                $noteFileConfig,
                $transcriptFileConfig
            );
        }

        throw new InvalidArgumentException(trans('asr.exception.sandbox_merge_timeout'));
    }
}
