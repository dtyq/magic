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
use App\Application\Speech\Enum\AsrTopicModeEnum;
use App\Application\Speech\Enum\SandboxAsrStatusEnum;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\InitializationMetadataDTO;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskContext;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrMarkerFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 沙箱服务
 * 负责沙箱任务启动、合并、轮询和文件记录创建.
 */
class AsrSandboxService extends AbstractAppService
{
    use HasLogger;

    public function __construct(
        private readonly AsrRecorderInterface $asrRecorder,
        private readonly AsrSandboxResponseHandler $responseHandler,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly AgentDomainService $agentDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly AsrTaskDomainService $asrTaskDomainService,
    ) {
    }

    /**
     * 启动录音任务.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token auto-fetched by create());
     *                                     every downstream SandboxGatewayInterface call forwards that token to the in-pod agent
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     */
    public function startRecordingTask(
        DataIsolation $dataIsolation,
        AsrTaskStatusDTO $taskStatus
    ): void {
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 获取完整工作目录路径
        $projectEntity = $this->getAccessibleProjectWithEditor((int) $taskStatus->projectId, $userId, $organizationCode);
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        // 创建沙箱并等待工作区可用（沙箱 id 由隐藏话题绑定的 sandbox_id 决定，
        // 未绑定则由 Domain 走 warm/cold 路径，与 chat 路径一致）
        $actualSandboxId = $this->ensureSandboxWorkspaceReady(
            $dataIsolation,
            $taskStatus,
            $taskStatus->projectId,
            $fullWorkdir
        );

        $this->logger->info('startRecordingTask ASR 录音：沙箱已就绪', [
            'task_key' => $taskStatus->taskKey,
            'actual_sandbox_id' => $actualSandboxId,
            'full_workdir' => $fullWorkdir,
        ]);

        // 构建文件配置对象（复用公共方法）
        $noteFileConfig = $this->buildNoteFileConfig($taskStatus);
        $transcriptFileConfig = $this->buildTranscriptFileConfig($taskStatus);
        $markerFileConfig = $this->buildMarkerFileConfig($taskStatus);

        $this->logger->info('准备调用沙箱 start 接口', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'temp_hidden_directory' => $taskStatus->tempHiddenDirectory,
            'workspace' => '.workspace',
            'note_file_config' => $noteFileConfig?->toArray(),
            'transcript_file_config' => $transcriptFileConfig?->toArray(),
            'marker_file_config' => $markerFileConfig?->toArray(),
        ]);

        // 调用沙箱启动任务
        // 注意：沙箱 API 只接受工作区相对路径 (如: .asr_recordings/session_xxx)
        $response = $this->asrRecorder->startTask(
            $dataIsolation,
            $actualSandboxId,
            $taskStatus->taskKey,
            $taskStatus->tempHiddenDirectory,  // 如: .asr_recordings/session_xxx
            '.workspace',
            $noteFileConfig,
            $transcriptFileConfig,
            $markerFileConfig
        );

        if (! $response->isSuccess()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxTaskCreationFailed, '', ['message' => $response->message]);
        }

        $this->syncAudioFormatFromResponse($taskStatus, $response);

        $taskStatus->sandboxTaskCreated = true;

        $this->logger->info('ASR 录音：沙箱任务已创建', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'status' => $response->getStatus(),
        ]);
    }

    /**
     * 取消录音任务.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token must be stamped)
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @return AsrRecorderResponse 响应结果
     */
    public function cancelRecordingTask(DataIsolation $dataIsolation, AsrTaskStatusDTO $taskStatus): AsrRecorderResponse
    {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        $this->logger->info('ASR 录音：准备取消沙箱任务', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
        ]);

        // 调用沙箱取消任务
        $response = $this->asrRecorder->cancelTask(
            $dataIsolation,
            $sandboxId,
            $taskStatus->taskKey
        );

        if (! $response->isSuccess()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxCancelFailed, '', ['message' => $response->message]);
        }

        $this->logger->info('ASR 录音：沙箱任务已取消', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
            'status' => $response->getStatus(),
        ]);

        return $response;
    }

    /**
     * 合并音频文件.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token must be stamped)
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名）
     * @param AsrTaskStatusEnum $targetStatus 目标状态，默认 COMPLETED
     * @return AsrSandboxMergeResultDTO 合并结果
     */
    public function mergeAudioFiles(
        DataIsolation $dataIsolation,
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle,
        AsrTaskStatusEnum $targetStatus = AsrTaskStatusEnum::COMPLETED
    ): AsrSandboxMergeResultDTO {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();

        $this->logger->info('开始沙箱音频处理流程', [
            'task_key' => $taskStatus->taskKey,
            'project_id' => $taskStatus->projectId,
            'hidden_directory' => $taskStatus->tempHiddenDirectory,
            'display_directory' => $taskStatus->displayDirectory,
            'sandbox_id' => $taskStatus->sandboxId,
        ]);

        // 获取完整工作目录路径
        $projectEntity = $this->getAccessibleProjectWithEditor((int) $taskStatus->projectId, $taskStatus->userId, $organizationCode);
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        // 记录调用前的沙箱 id，用于判断沙箱是否在初始化过程中发生了重建
        $requestedSandboxId = $taskStatus->sandboxId;
        $actualSandboxId = $this->ensureSandboxWorkspaceReady(
            $dataIsolation,
            $taskStatus,
            $taskStatus->projectId,
            $fullWorkdir
        );

        // 更新实际的沙箱ID（可能已经变化）
        if ($actualSandboxId !== $requestedSandboxId) {
            $this->logger->warning('沙箱ID发生变化，可能是沙箱重启', [
                'task_key' => $taskStatus->taskKey,
                'old_sandbox_id' => $requestedSandboxId,
                'new_sandbox_id' => $actualSandboxId,
            ]);
        }

        $this->logger->info('沙箱已就绪，准备调用 finish', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'full_workdir' => $fullWorkdir,
        ]);

        // 调用沙箱 finish 并轮询等待完成
        $mergeResult = $this->callSandboxFinishAndWait($dataIsolation, $taskStatus, $fileTitle);
        $this->handleMergeResultFiles($taskStatus, $mergeResult);

        $this->logger->info('沙箱返回的文件信息', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_file_path' => $mergeResult->filePath,
            'audio_file_id' => $taskStatus->audioFileId,
            'note_file_id' => $taskStatus->noteFileId,
        ]);

        // 更新任务状态（文件记录已由响应处理器创建）
        $taskStatus->updateStatus($targetStatus);

        $this->logger->info('沙箱音频处理完成', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'file_id' => $taskStatus->audioFileId,
            'file_path' => $taskStatus->filePath,
        ]);

        return $mergeResult;
    }

    /**
     * 恢复 finish-recording 合并流程.
     *
     * 先查询沙箱真实状态：已完成则只补 magic-service 收尾；仍在处理中则重新提交一次 finish 并继续轮询。
     *
     * @param DataIsolation $dataIsolation per-call user identity (token must be stamped)
     */
    public function recoverFinishRecording(
        DataIsolation $dataIsolation,
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle,
        AsrTaskStatusEnum $targetStatus = AsrTaskStatusEnum::COMPLETED
    ): AsrSandboxMergeResultDTO {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $sandboxId = $taskStatus->sandboxId;
        if (empty($sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        $this->logger->info('开始恢复 finish-recording 沙箱合并', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
            'project_id' => $taskStatus->projectId,
        ]);

        $finishStartTime = microtime(true);
        $queryResponse = $this->asrRecorder->queryTask($dataIsolation, $sandboxId, $taskStatus->taskKey, '.workspace');
        if ($this->isTransportFailureResponse($queryResponse)) {
            $this->logger->warning('恢复 finish-recording 时沙箱不可达，尝试重建沙箱', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'code' => $queryResponse->code,
                'message' => $queryResponse->message,
            ]);

            try {
                $projectEntity = $this->getAccessibleProjectWithEditor(
                    (int) $taskStatus->projectId,
                    $taskStatus->userId,
                    $organizationCode
                );
                $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
                $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

                $actualSandboxId = $this->ensureSandboxWorkspaceReady(
                    $dataIsolation,
                    $taskStatus,
                    $taskStatus->projectId,
                    $fullWorkdir
                );

                $taskStatus->sandboxId = $actualSandboxId;
                $taskStatus->sandboxTaskCreated = true;

                $this->logger->info('finish-recording 恢复：沙箱重建成功，直接提交合并', [
                    'task_key' => $taskStatus->taskKey,
                    'old_sandbox_id' => $sandboxId,
                    'new_sandbox_id' => $actualSandboxId,
                ]);

                $mergeResult = $this->callSandboxFinishAndWait($dataIsolation, $taskStatus, $fileTitle, true);
                $taskStatus->updateStatus($targetStatus);

                return $mergeResult;
            } catch (Throwable $e) {
                $this->logger->error('恢复 finish-recording 时沙箱重建失败', [
                    'task_key' => $taskStatus->taskKey,
                    'old_sandbox_id' => $sandboxId,
                    'new_sandbox_id' => $taskStatus->sandboxId,
                    'original_query_error' => $queryResponse->getErrorMessage(),
                    'audio_file_path' => $taskStatus->filePath,
                    'error' => $e->getMessage(),
                ]);
                throw $e;
            }
        }

        $statusString = $queryResponse->getStatus();
        $status = SandboxAsrStatusEnum::fromString($statusString) ?? SandboxAsrStatusEnum::ERROR;

        // super-magic 已进入 error 时，recover 需要重新提交 finish；
        // super-magic finish 接口会先原子重置任务并启动新一轮监听。
        // force_reset=true 会忽略并清零沙箱侧重试计数，救回重试耗尽后无法再触发的任务。
        if ($status->isError()) {
            $this->logger->warning('finish-recording 恢复：沙箱任务已失败，重新提交 finish 重试', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'error_message' => $queryResponse->getErrorMessage(),
            ]);

            $mergeResult = $this->callSandboxFinishAndWait($dataIsolation, $taskStatus, $fileTitle, true);
            $taskStatus->updateStatus($targetStatus);

            return $mergeResult;
        }

        $completedResult = $this->checkResponseStatus(
            $queryResponse,
            $status,
            $taskStatus,
            $sandboxId,
            $finishStartTime,
            0
        );
        if ($completedResult !== null) {
            $taskStatus->updateStatus($targetStatus);
            $this->logger->info('finish-recording 恢复完成：沙箱已完成，仅补本地收尾', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'file_path' => $completedResult->filePath,
            ]);
            return $completedResult;
        }

        $this->logger->info('finish-recording 恢复：沙箱仍在处理中，重新提交 finish 并继续轮询', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
            'status' => $status->value,
        ]);

        $mergeResult = $this->callSandboxFinishAndWait($dataIsolation, $taskStatus, $fileTitle, true);
        $taskStatus->updateStatus($targetStatus);

        return $mergeResult;
    }

    /**
     * 处理沙箱 completed 响应中的文件记录。
     * 恢复流程会在调用本方法之前先持久化沙箱完成检查点。
     */
    public function handleMergeResultFiles(
        AsrTaskStatusDTO $taskStatus,
        AsrSandboxMergeResultDTO $mergeResult
    ): void {
        $this->responseHandler->handleFinishResponse($taskStatus, $mergeResult->responseData);
    }

    /**
     * 调用沙箱 finish 并轮询等待完成.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token must be stamped)
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能标题（用于重命名）
     * @param bool $forceReset 是否强制重置沙箱侧重试计数（手动重新合并场景）
     * @return AsrSandboxMergeResultDTO 合并结果
     */
    private function callSandboxFinishAndWait(
        DataIsolation $dataIsolation,
        AsrTaskStatusDTO $taskStatus,
        string $intelligentTitle,
        bool $forceReset = false
    ): AsrSandboxMergeResultDTO {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        // 构建音频配置对象
        $audioConfig = new AsrAudioConfig(
            sourceDir: $taskStatus->tempHiddenDirectory,  // 如: .asr_recordings/session_xxx
            targetDir: $taskStatus->displayDirectory,     // 如: 录音总结_20251027_230949
            outputFilename: $intelligentTitle,             // 如: 被讨厌的勇气
            fileShardCount: $taskStatus->fileShardCount
        );

        // 构建笔记文件配置对象（需要重命名）
        $noteFileConfig = $this->buildNoteFileConfig(
            $taskStatus,
            $taskStatus->displayDirectory,
            $intelligentTitle
        );

        // 构建流式识别文件配置对象
        $transcriptFileConfig = $this->buildTranscriptFileConfig($taskStatus);

        // 构建标记文件配置对象（保持在隐藏目录）
        $markerFileConfig = $this->buildMarkerFileConfig(
            $taskStatus,
            null,
            $intelligentTitle
        );

        $this->logger->info('准备提交沙箱 ASR 合并', [
            'task_key' => $taskStatus->taskKey,
            'intelligent_title' => $intelligentTitle,
            'force_reset' => $forceReset,
            'audio_config' => $audioConfig->toArray(),
            'note_file_config' => $noteFileConfig?->toArray(),
            'transcript_file_config' => $transcriptFileConfig?->toArray(),
            'marker_file_config' => $markerFileConfig?->toArray(),
        ]);

        // 记录开始时间
        $finishStartTime = microtime(true);

        // 首次调用 finish：提交“上传已完成，可以合并”的命令。
        $response = $this->asrRecorder->finishTask(
            $dataIsolation,
            $sandboxId,
            $taskStatus->taskKey,
            '.workspace',
            $audioConfig,
            $noteFileConfig,
            $transcriptFileConfig,
            $markerFileConfig,
            $forceReset
        );

        if ($this->isTransportFailureResponse($response)) {
            $submitErrorMessage = $response->getErrorMessage() ?? '提交沙箱 ASR 合并失败';
            $this->logger->warning('提交沙箱 ASR 合并状态未知，尝试查询任务状态', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'code' => $response->code,
                'message' => $response->message,
            ]);

            $queryResponse = $this->asrRecorder->queryTask($dataIsolation, $sandboxId, $taskStatus->taskKey, '.workspace');
            if ($this->isTransportFailureResponse($queryResponse)) {
                $this->logger->error('提交沙箱 ASR 合并失败，且无法查询确认任务状态', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'finish_error' => $submitErrorMessage,
                    'query_error' => $queryResponse->getErrorMessage(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::SandboxMergeFailed, '', ['message' => $submitErrorMessage]);
            }

            $response = $queryResponse;
        }

        // 轮询等待完成（基于预设时间与休眠间隔）
        $timeoutSeconds = AsrConfig::SANDBOX_MERGE_TIMEOUT;
        $pollingInterval = AsrConfig::POLLING_INTERVAL;
        $attempt = 0;
        $lastLogTime = $finishStartTime;
        $logInterval = AsrConfig::SANDBOX_MERGE_LOG_INTERVAL;

        while (true) {
            $elapsedSeconds = (int) (microtime(true) - $finishStartTime);

            if ($elapsedSeconds >= $timeoutSeconds) {
                break;
            }

            ++$attempt;

            $statusString = $response->getStatus();
            $status = SandboxAsrStatusEnum::fromString($statusString) ?? SandboxAsrStatusEnum::ERROR;

            // 检查完成状态或错误状态
            $result = $this->checkResponseStatus(
                $response,
                $status,
                $taskStatus,
                $sandboxId,
                $finishStartTime,
                $attempt
            );
            if ($result !== null) {
                return $result;
            }

            // 中间状态（waiting, running, finalizing）：继续轮询并按间隔记录进度
            $currentTime = microtime(true);
            $elapsedSeconds = (int) ($currentTime - $finishStartTime);
            if ($attempt % AsrConfig::SANDBOX_MERGE_LOG_FREQUENCY === 0 || ($currentTime - $lastLogTime) >= $logInterval) {
                $remainingSeconds = max(0, $timeoutSeconds - $elapsedSeconds);
                $this->logger->info('等待并查询沙箱 ASR 合并状态', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'elapsed_seconds' => $elapsedSeconds,
                    'remaining_seconds' => $remainingSeconds,
                    'status' => $status->value ?? $statusString,
                    'status_description' => $status->getDescription(),
                ]);
                $lastLogTime = $currentTime;
            }

            // 时间不足，不再 sleep，直接进行最后一次 finishTask
            if (($elapsedSeconds + $pollingInterval) >= $timeoutSeconds) {
                break;
            }

            sleep($pollingInterval);

            // 继续轮询：finish 只提交一次，后续只查询状态。
            $queryResponse = $this->asrRecorder->queryTask($dataIsolation, $sandboxId, $taskStatus->taskKey, '.workspace');
            if ($this->isTransportFailureResponse($queryResponse)) {
                $this->logger->warning('查询沙箱 ASR 合并状态失败，将继续轮询', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'code' => $queryResponse->code,
                    'message' => $queryResponse->message,
                    'error_message' => $queryResponse->getErrorMessage(),
                ]);
                continue;
            }

            $response = $queryResponse;
        }

        // 时间即将耗尽，进行最后一次检查
        $statusString = $response->getStatus();
        $status = SandboxAsrStatusEnum::fromString($statusString) ?? SandboxAsrStatusEnum::ERROR;
        $result = $this->checkResponseStatus(
            $response,
            $status,
            $taskStatus,
            $sandboxId,
            $finishStartTime,
            $attempt
        );
        if ($result !== null) {
            return $result;
        }

        // 超时记录
        $totalElapsedTime = (int) (microtime(true) - $finishStartTime);
        $this->logger->error('沙箱音频合并超时', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
            'total_attempts' => $attempt,
            'total_elapsed_seconds' => $totalElapsedTime,
            'timeout_seconds' => $timeoutSeconds,
            'last_status' => $status->value ?? $statusString,
        ]);

        ExceptionBuilder::throw(AsrErrorCode::SandboxMergeTimeout);
    }

    private function isTransportFailureResponse(AsrRecorderResponse $response): bool
    {
        return ! $response->isSuccess() && ! $response->hasTaskStatus();
    }

    /**
     * 检查并处理沙箱响应状态.
     *
     * @param AsrRecorderResponse $response 沙箱响应
     * @param SandboxAsrStatusEnum $status 状态枚举
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $sandboxId 沙箱ID
     * @param float $finishStartTime 开始时间
     * @param int $attempt 尝试次数
     * @return null|AsrSandboxMergeResultDTO 如果完成则返回结果，否则返回null
     * @throws BusinessException 如果是错误状态则抛出异常
     */
    private function checkResponseStatus(
        AsrRecorderResponse $response,
        SandboxAsrStatusEnum $status,
        AsrTaskStatusDTO $taskStatus,
        string $sandboxId,
        float $finishStartTime,
        int $attempt
    ): ?AsrSandboxMergeResultDTO {
        $this->syncAudioFormatFromResponse($taskStatus, $response);

        // 检查是否为完成状态（包含 completed 和 finished）
        if ($status->isCompleted()) {
            // 计算总耗时
            $finishEndTime = microtime(true);
            $totalElapsedTime = round($finishEndTime - $finishStartTime);

            $this->logger->info('沙箱音频合并完成', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'attempt' => $attempt,
                'status' => $status->value,
                'file_path' => $response->getFilePath(),
                'total_elapsed_time_seconds' => $totalElapsedTime,
            ]);

            $responseData = $response->getData();

            return AsrSandboxMergeResultDTO::fromSandboxResponse([
                'status' => $status->value,
                'file_path' => $response->getFilePath(),
                'duration' => $response->getDuration(),
                'file_size' => $response->getFileSize(),
                'response_data' => $responseData,
            ]);
        }

        // 检查是否为错误状态
        if ($status->isError()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxMergeFailed, '', ['message' => $response->getErrorMessage()]);
        }

        return null;
    }

    private function syncAudioFormatFromResponse(AsrTaskStatusDTO $taskStatus, AsrRecorderResponse $response): void
    {
        $audioFormat = $response->getAudioFormat();
        if ($audioFormat === null) {
            return;
        }

        $this->asrTaskDomainService->setAudioFormat($taskStatus, $audioFormat);
    }

    /**
     * 通过 AgentDomainService 创建沙箱并等待工作区就绪（使用分布式锁版本）.
     *
     * 使用 AgentDomainService::ensureSandboxInitialized 方法，该方法：
     * - 使用基于 topic_id 的分布式锁，防止并发创建
     * - 在锁内进行双重检查，避免重复初始化
     * - 使用 spinLock 机制，并发请求会等待（最多 60 秒）
     *
     * 与 chat 路径（HandleUserMessageAppService::createAndSendMessageToAgent）保持一致：
     * 沙箱 id 完全由隐藏话题绑定的 sandbox_id 决定（未绑定则为空字符串），由 Domain 内部
     * 决定走 warm 池还是冷创建。不要把上层自造的 sandbox_id 传进 buildInitAgentContext，
     * 否则会触发 tryWarmPoolFastPath 的「已有 sandbox_id 跳过 warm 池」守卫。
     */
    private function ensureSandboxWorkspaceReady(
        DataIsolation $dataIsolation,
        AsrTaskStatusDTO $taskStatus,
        ?string $projectId,
        string $fullWorkdir
    ): string {
        $projectIdString = (string) $projectId;
        if ($projectIdString === '') {
            ExceptionBuilder::throw(AsrErrorCode::SandboxTaskCreationFailed, '', ['message' => '项目ID为空，无法创建沙箱']);
        }

        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 1. 为沙箱获取/创建隐藏话题（与总结用话题分离）
        $sandboxTopicId = $this->ensureSandboxHiddenTopic($taskStatus, $userId);
        $taskStatus->sandboxTopicId = $sandboxTopicId;

        // 3. 获取 topic 实体
        $topicEntity = $this->topicDomainService->getTopicById($sandboxTopicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(
                AsrErrorCode::SandboxTaskCreationFailed,
                '',
                ['message' => '话题不存在']
            );
        }

        // 4. 获取项目实体
        $projectEntity = $this->getAccessibleProjectWithEditor((int) $projectId, $userId, $organizationCode);
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();

        // 5. 先创建 Task Entity 并更新 TopicEntity（确保 current_task_id 有值）
        // 这样 ensureSandboxInitialized 内部构建 TaskContext 时，super_magic_task_id 才会有值
        // Note: 传递 TopicEntity 避免 initAsrTask 内部重复查询
        $taskEntity = $this->taskDomainService->initAsrTask(
            $dataIsolation,
            $topicEntity,
            $projectIdString
        );

        $this->logger->info('[ASR][Sandbox] Task Entity 已创建（initAsrTask 已自动更新 TopicEntity）', [
            'task_key' => $taskStatus->taskKey,
            'task_id' => $taskEntity->getId(),
            'sandbox_topic_id' => $sandboxTopicId,
        ]);

        // 6. 重新获取 topicEntity（确保使用 initAsrTask 更新后的最新 current_task_id）
        $topicEntity = $this->topicDomainService->getTopicById($sandboxTopicId);

        // 7. 构建 InitializationMetadataDTO（ASR 场景设置 skipInitMessages = true）

        // 话题已绑定的沙箱 id（未绑定则为空），作为 ensureSandboxInitialized 的探测/复用入口
        $boundSandboxId = (string) $topicEntity->getSandboxId();

        $this->logger->info('[ASR][Sandbox] 准备使用 ensureSandboxInitialized（带锁版本）', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_topic_id' => $sandboxTopicId,
            'bound_sandbox_id' => $boundSandboxId,
            'full_workdir' => $fullWorkdir,
            'task_id' => $taskEntity->getId(),
        ]);

        // 8. 调用 AgentDomainService::ensureSandboxInitialized（自动使用分布式锁）
        // 此时 TopicEntity.current_task_id 已经有值，所以 super_magic_task_id 会正确传递
        try {
            // 与 chat 路径一致：传话题已绑定的 sandbox_id（未绑定则为空），由 Domain 决定
            // 走 warm 池还是冷创建。
            $agentContext = $this->agentDomainService->buildInitAgentContext(
                dataIsolation: $dataIsolation,
                projectEntity: $projectEntity,
                topicEntity: $topicEntity,
                taskEntity: $taskEntity,
                sandboxId: $boundSandboxId,
                skipInitMessage: true
            );

            $actualSandboxId = $this->agentDomainService->ensureSandboxInitialized(
                $dataIsolation,
                $agentContext,
                // ASR 属于工具执行场景，不挂载 .topic 话题目录，只挂 project/user 空间
                new SandboxRootFileIds(
                    (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId()),
                    (string) $this->taskFileDomainService->findOrCreateUserRootDirectory($userId, $organizationCode)
                )
            );

            $this->logger->info('[ASR][Sandbox] 沙箱初始化完成（带锁保护）', [
                'task_key' => $taskStatus->taskKey,
                'bound_sandbox_id' => $boundSandboxId,
                'actual_sandbox_id' => $actualSandboxId,
                'task_id' => $taskEntity->getId(),
            ]);

            $taskStatus->sandboxId = $actualSandboxId;

            // 9. 更新话题和任务的 sandbox_id 以及状态为 finished
            $this->topicDomainService->updateTopicStatusAndSandboxId(
                $sandboxTopicId,
                $taskEntity->getId(),
                TaskStatus::FINISHED,
                $actualSandboxId
            );

            $this->taskDomainService->updateTaskStatus(
                TaskStatus::FINISHED,
                $taskEntity->getId(),
                (string) $taskEntity->getId(),
                $actualSandboxId,
                ''
            );

            $this->logger->info('[ASR][Sandbox] 话题和任务状态已更新为 finished', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_topic_id' => $sandboxTopicId,
                'task_id' => $taskEntity->getId(),
                'sandbox_id' => $actualSandboxId,
            ]);

            return $actualSandboxId;
        } catch (Throwable $e) {
            $this->logger->error('[ASR][Sandbox] 沙箱初始化失败', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $boundSandboxId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * 获取或创建 ASR 沙箱专用隐藏话题（同项目复用，跨项目新建）.
     */
    private function ensureSandboxHiddenTopic(AsrTaskStatusDTO $taskStatus, string $userId): int
    {
        $projectId = (int) $taskStatus->projectId;
        // 1) 任务状态里已有 sandbox_topic_id，且存在则复用
        if (! empty($taskStatus->sandboxTopicId)) {
            $existing = $this->topicDomainService->getTopicById((int) $taskStatus->sandboxTopicId);
            if ($existing
                && $existing->isHidden()
                && $existing->getProjectId() === $projectId
                && $existing->getUserId() === $userId
                && $existing->getTopicMode() === AsrTopicModeEnum::AUDIO_MERGE->value) {
                return (int) $taskStatus->sandboxTopicId;
            }

            $this->logger->warning('任务状态中的 sandbox_topic_id 不存在，尝试复用已有隐藏话题', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_topic_id' => $taskStatus->sandboxTopicId,
                'project_id' => $projectId,
            ]);
        }

        // 2) 查找当前用户+项目的隐藏话题，存在则复用
        $hidden = $this->topicDomainService->findHiddenTopicByProjectUserAndMode(
            $projectId,
            $userId,
            AsrTopicModeEnum::AUDIO_MERGE->value
        );
        if ($hidden) {
            return $hidden->getId();
        }

        // 3) 不在此处创建隐藏话题，要求上游 API 已创建
        $this->logger->error('缺少 ASR 隐藏话题，请通过 AsrApi 确保 sandbox_topic_id 已创建并下发', [
            'task_key' => $taskStatus->taskKey,
            'project_id' => $projectId,
            'user_id' => $userId,
        ]);

        ExceptionBuilder::throw(
            AsrErrorCode::SandboxTaskCreationFailed,
            '',
            ['message' => 'topic unavailable for sandbox initialization']
        );
    }

    /**
     * 构建笔记文件配置对象.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param null|string $targetDirectory 目标目录（可选，默认与源目录相同）
     * @param null|string $intelligentTitle 智能标题（可选，用于重命名）
     */
    private function buildNoteFileConfig(
        AsrTaskStatusDTO $taskStatus,
        ?string $targetDirectory = null,
        ?string $intelligentTitle = null
    ): ?AsrNoteFileConfig {
        if (empty($taskStatus->presetNoteFilePath)) {
            return null;
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetNoteFilePath);

        // 如果未指定目标目录，使用源路径（不重命名）
        if ($targetDirectory === null || $intelligentTitle === null) {
            return new AsrNoteFileConfig(
                sourcePath: $workspaceRelativePath,
                targetPath: $workspaceRelativePath
            );
        }

        // 需要重命名：使用智能标题和国际化的笔记后缀构建目标路径
        $fileExtension = pathinfo($workspaceRelativePath, PATHINFO_EXTENSION);
        $noteSuffix = trans('asr.file_names.note_suffix'); // 根据语言获取国际化的"笔记"/"Note"
        $noteFilename = sprintf('%s-%s.%s', $intelligentTitle, $noteSuffix, $fileExtension);

        return new AsrNoteFileConfig(
            sourcePath: $workspaceRelativePath,
            targetPath: rtrim($targetDirectory, '/') . '/' . $noteFilename
        );
    }

    /**
     * 构建流式识别文件配置对象.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     */
    private function buildTranscriptFileConfig(AsrTaskStatusDTO $taskStatus): ?AsrTranscriptFileConfig
    {
        if (empty($taskStatus->presetTranscriptFilePath)) {
            return null;
        }

        $transcriptWorkspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath(
            $taskStatus->presetTranscriptFilePath
        );

        return new AsrTranscriptFileConfig(
            sourcePath: $transcriptWorkspaceRelativePath
        );
    }

    /**
     * 构建标记文件配置对象.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param null|string $targetDirectory 目标目录（用于重命名）
     * @param null|string $intelligentTitle 智能标题（用于重命名）
     * @return null|AsrMarkerFileConfig 标记文件配置
     */
    private function buildMarkerFileConfig(
        AsrTaskStatusDTO $taskStatus,
        ?string $targetDirectory = null,
        ?string $intelligentTitle = null
    ): ?AsrMarkerFileConfig {
        if (empty($taskStatus->presetMarkerFilePath)) {
            return null;
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetMarkerFilePath);

        // 如果未指定目标目录，使用源路径（不重命名）
        // 注意：标记文件始终在隐藏目录中，不移动到显示目录
        if ($targetDirectory === null || $intelligentTitle === null) {
            return new AsrMarkerFileConfig(
                sourcePath: $workspaceRelativePath,
                targetPath: $workspaceRelativePath
            );
        }

        // 标记文件保持在隐藏目录中，只重命名文件名
        // 从源路径提取目录部分
        $sourceDirectory = dirname($workspaceRelativePath);
        $fileExtension = pathinfo($workspaceRelativePath, PATHINFO_EXTENSION);
        $markerSuffix = trans('asr.file_names.marker_suffix'); // 根据语言获取国际化的"标记"/"Marker"
        $markerFilename = sprintf('%s-%s.%s', $intelligentTitle, $markerSuffix, $fileExtension);

        return new AsrMarkerFileConfig(
            sourcePath: $workspaceRelativePath,
            targetPath: rtrim($sourceDirectory, '/') . '/' . $markerFilename
        );
    }
}
