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
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\InitializationMetadataDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrMarkerFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
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
        private readonly SandboxGatewayInterface $sandboxGateway,
        private readonly AsrRecorderInterface $asrRecorder,
        private readonly AsrSandboxResponseHandler $responseHandler,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly AgentDomainService $agentDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
    ) {
    }

    /**
     * 启动录音任务.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
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

        // 获取完整工作目录路径
        $projectEntity = $this->getAccessibleProjectWithEditor((int) $taskStatus->projectId, $userId, $organizationCode);
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        // 创建沙箱并等待工作区可用
        $actualSandboxId = $this->ensureSandboxWorkspaceReady(
            $taskStatus,
            $sandboxId,
            $taskStatus->projectId,
            $fullWorkdir,
            $userId,
            $organizationCode
        );

        $this->logger->info('startRecordingTask ASR 录音：沙箱已就绪', [
            'task_key' => $taskStatus->taskKey,
            'requested_sandbox_id' => $sandboxId,
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
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @return AsrRecorderResponse 响应结果
     */
    public function cancelRecordingTask(AsrTaskStatusDTO $taskStatus): AsrRecorderResponse
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
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名）
     * @param string $organizationCode 组织编码
     * @param AsrTaskStatusEnum $targetStatus 目标状态，默认 COMPLETED
     * @return AsrSandboxMergeResultDTO 合并结果
     */
    public function mergeAudioFiles(
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle,
        string $organizationCode,
        AsrTaskStatusEnum $targetStatus = AsrTaskStatusEnum::COMPLETED
    ): AsrSandboxMergeResultDTO {
        $this->logger->info('开始沙箱音频处理流程', [
            'task_key' => $taskStatus->taskKey,
            'project_id' => $taskStatus->projectId,
            'hidden_directory' => $taskStatus->tempHiddenDirectory,
            'display_directory' => $taskStatus->displayDirectory,
            'sandbox_id' => $taskStatus->sandboxId,
        ]);

        // 准备沙箱ID
        if (empty($taskStatus->sandboxId)) {
            $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
                $taskStatus->projectId . '_asr_recording',
                12
            );
            $taskStatus->sandboxId = $sandboxId;
        }

        // 设置用户上下文
        $this->sandboxGateway->setUserContext($taskStatus->userId, $organizationCode);

        // 获取完整工作目录路径
        $projectEntity = $this->getAccessibleProjectWithEditor((int) $taskStatus->projectId, $taskStatus->userId, $organizationCode);
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        $requestedSandboxId = $taskStatus->sandboxId;
        $actualSandboxId = $this->ensureSandboxWorkspaceReady(
            $taskStatus,
            $requestedSandboxId,
            $taskStatus->projectId,
            $fullWorkdir,
            $taskStatus->userId,
            $organizationCode
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

        // 调用沙箱 finish 并轮询等待完成（会通过响应处理器自动创建/更新文件记录）
        $mergeResult = $this->callSandboxFinishAndWait($taskStatus, $fileTitle);

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
     * 调用沙箱 finish 并轮询等待完成.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能标题（用于重命名）
     * @return AsrSandboxMergeResultDTO 合并结果
     */
    private function callSandboxFinishAndWait(
        AsrTaskStatusDTO $taskStatus,
        string $intelligentTitle,
    ): AsrSandboxMergeResultDTO {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        // 构建音频配置对象
        $audioConfig = new AsrAudioConfig(
            sourceDir: $taskStatus->tempHiddenDirectory,  // 如: .asr_recordings/session_xxx
            targetDir: $taskStatus->displayDirectory,     // 如: 录音总结_20251027_230949
            outputFilename: $intelligentTitle              // 如: 被讨厌的勇气
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

        $this->logger->info('准备调用沙箱 finish', [
            'task_key' => $taskStatus->taskKey,
            'intelligent_title' => $intelligentTitle,
            'audio_config' => $audioConfig->toArray(),
            'note_file_config' => $noteFileConfig?->toArray(),
            'transcript_file_config' => $transcriptFileConfig?->toArray(),
            'marker_file_config' => $markerFileConfig?->toArray(),
        ]);

        // 记录开始时间
        $finishStartTime = microtime(true);

        // 首次调用 finish
        $response = $this->asrRecorder->finishTask(
            $sandboxId,
            $taskStatus->taskKey,
            '.workspace',
            $audioConfig,
            $noteFileConfig,
            $transcriptFileConfig,
            $markerFileConfig
        );

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
            $status = SandboxAsrStatusEnum::from($statusString);

            // 检查完成状态或错误状态
            $result = $this->checkAndHandleResponseStatus(
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
                $this->logger->info('等待沙箱音频合并', [
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

            // 继续轮询
            $response = $this->asrRecorder->finishTask(
                $sandboxId,
                $taskStatus->taskKey,
                '.workspace',
                $audioConfig,
                $noteFileConfig,
                $transcriptFileConfig
            );
        }

        // 时间即将耗尽，进行最后一次检查
        $statusString = $response->getStatus();
        $status = SandboxAsrStatusEnum::from($statusString);
        $result = $this->checkAndHandleResponseStatus(
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
    private function checkAndHandleResponseStatus(
        AsrRecorderResponse $response,
        SandboxAsrStatusEnum $status,
        AsrTaskStatusDTO $taskStatus,
        string $sandboxId,
        float $finishStartTime,
        int $attempt
    ): ?AsrSandboxMergeResultDTO {
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

            // 处理沙箱响应，更新文件和目录记录
            $responseData = $response->getData();
            $this->responseHandler->handleFinishResponse(
                $taskStatus,
                $responseData,
            );

            return AsrSandboxMergeResultDTO::fromSandboxResponse([
                'status' => $status->value,
                'file_path' => $response->getFilePath(),
                'duration' => $response->getDuration(),
                'file_size' => $response->getFileSize(),
            ]);
        }

        // 检查是否为错误状态
        if ($status->isError()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxMergeFailed, '', ['message' => $response->getErrorMessage()]);
        }

        return null;
    }

    /**
     * 通过 AgentDomainService 创建沙箱并等待工作区就绪（使用分布式锁版本）.
     *
     * 使用 AgentDomainService::ensureSandboxInitialized 方法，该方法：
     * - 使用基于 topic_id 的分布式锁，防止并发创建
     * - 在锁内进行双重检查，避免重复初始化
     * - 使用 spinLock 机制，并发请求会等待（最多 60 秒）
     */
    private function ensureSandboxWorkspaceReady(
        AsrTaskStatusDTO $taskStatus,
        string $requestedSandboxId,
        ?string $projectId,
        string $fullWorkdir,
        string $userId,
        string $organizationCode
    ): string {
        if ($requestedSandboxId === '') {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        $projectIdString = (string) $projectId;
        if ($projectIdString === '') {
            ExceptionBuilder::throw(AsrErrorCode::SandboxTaskCreationFailed, '', ['message' => '项目ID为空，无法创建沙箱']);
        }

        // 1. 创建 DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        // 2. 为沙箱获取/创建隐藏话题（与总结用话题分离）
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

        $this->logger->info('[ASR][Sandbox] 准备使用 ensureSandboxInitialized（带锁版本）', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_topic_id' => $sandboxTopicId,
            'requested_sandbox_id' => $requestedSandboxId,
            'full_workdir' => $fullWorkdir,
            'task_id' => $taskEntity->getId(),
        ]);

        // 8. 调用 AgentDomainService::ensureSandboxInitialized（自动使用分布式锁）
        // 此时 TopicEntity.current_task_id 已经有值，所以 super_magic_task_id 会正确传递
        try {
            $agentContext = $this->agentDomainService->buildInitAgentContext(
                dataIsolation: $dataIsolation,
                projectEntity: $projectEntity,
                topicEntity: $topicEntity,
                taskEntity: $taskEntity,
                sandboxId: $requestedSandboxId,
                skipInitMessage: true
            );

            $actualSandboxId = $this->agentDomainService->ensureSandboxInitialized($dataIsolation, $agentContext);

            $this->logger->info('[ASR][Sandbox] 沙箱初始化完成（带锁保护）', [
                'task_key' => $taskStatus->taskKey,
                'requested_sandbox_id' => $requestedSandboxId,
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
                'sandbox_id' => $requestedSandboxId,
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
            if ($existing) {
                return (int) $taskStatus->sandboxTopicId;
            }

            $this->logger->warning('任务状态中的 sandbox_topic_id 不存在，尝试复用已有隐藏话题', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_topic_id' => $taskStatus->sandboxTopicId,
                'project_id' => $projectId,
            ]);
        }

        // 2) 查找当前用户+项目的隐藏话题，存在则复用
        $hidden = $this->topicDomainService->findHiddenTopicByProjectAndUser($projectId, $userId);
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
