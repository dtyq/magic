<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\Assembler\ChatMessageAssembler;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Application\Speech\DTO\Response\AsrFileDataDTO;
use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Event\AsrSummaryMessage;
use App\Application\Speech\Event\Publish\AsrSummaryPublisher;
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\AsrErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus as SuperAgentTaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectHiddenStatusUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AudioProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Amqp\Producer;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * ASR文件管理应用服务 - 负责ASR相关的核心业务编排.
 */
class AsrFileAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly Producer $producer,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly Redis $redis,
        private readonly ChatMessageAssembler $chatMessageAssembler,
        private readonly MagicChatMessageAppService $magicChatMessageAppService,
        private readonly MagicChatDomainService $magicChatDomainService,
        private readonly TopicDomainService $superAgentTopicDomainService,
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly AudioProjectDomainService $audioProjectDomainService,
        private readonly TranslatorInterface $translator,
        // 新注入的 Service
        private readonly AsrTaskDomainService $asrTaskDomainService,
        private readonly AsrValidationService $validationService,
        private readonly AsrDirectoryService $directoryService,
        private readonly AsrTitleGeneratorService $titleGeneratorService,
        private readonly AsrSandboxService $asrSandboxService,
        private readonly AsrPresetFileService $presetFileService,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrFileAppService');
    }

    /**
     * 处理ASR总结任务的完整流程（包含聊天消息发送）.
     */
    public function processSummaryWithChat(
        SummaryRequestDTO $summaryRequest,
        MagicUserAuthorization $userAuthorization
    ): array {
        try {
            $userId = $userAuthorization->getId();
            $organizationCode = $userAuthorization->getOrganizationCode();

            // 1. 验证话题并获取对话ID
            $topicEntity = $this->validationService->validateTopicOwnership((int) $summaryRequest->topicId, $userId);
            $chatTopicId = $topicEntity->getChatTopicId();
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

            // 2. 验证任务状态（如果有file_id则跳过）
            if (! $summaryRequest->hasFileId()) {
                $this->validationService->validateTaskStatus($summaryRequest->taskKey, $userId);
            }

            // 3. 验证项目权限
            $this->validationService->getAccessibleProjectWithEditor((int) $summaryRequest->projectId, $userId, $organizationCode);

            // 4. 查询项目、工作区和话题信息
            [$projectName, $workspaceName] = $this->getProjectAndWorkspaceNames($summaryRequest->projectId);
            $topicName = $topicEntity->getTopicName();

            // 5. 更新空项目/话题名称（如果有生成的标题）
            if (! empty($summaryRequest->generatedTitle) && $this->shouldUpdateNames($projectName, $topicName)) {
                $this->updateEmptyProjectAndTopicNames(
                    $summaryRequest->projectId,
                    (int) $summaryRequest->topicId,
                    $summaryRequest->generatedTitle,
                    $userId,
                    $organizationCode
                );
                $projectName = empty(trim($projectName ?? '')) ? $summaryRequest->generatedTitle : $projectName;
                $topicName = empty(trim($topicName)) ? $summaryRequest->generatedTitle : $topicName;
            }

            // 6. MQ 执行录音总结流程：由 Consumer 负责重试（1分钟间隔，最多10次）
            $this->publishSummaryToMq($summaryRequest, $userAuthorization);

            return [
                'success' => true,
                'task_status' => null,
                'conversation_id' => $conversationId,
                'chat_result' => true,
                'topic_name' => $topicName,
                'project_name' => $projectName,
                'workspace_name' => $workspaceName,
            ];
        } catch (Throwable $e) {
            $this->logger->error('处理ASR总结任务失败', [
                'task_key' => $summaryRequest->taskKey,
                'error' => $e->getMessage(),
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'task_status' => null,
                'conversation_id' => null,
                'chat_result' => ['success' => false, 'message_sent' => false, 'error' => $e->getMessage()],
            ];
        }
    }

    /**
     * 处理ASR总结任务的异步执行流程.
     * @throws Throwable
     */
    public function handleAsrSummary(
        SummaryRequestDTO $summaryRequest,
        string $userId,
        string $organizationCode
    ): void {
        // 锁维度：user_id + task_key，避免不同用户 task_key 碰撞互相阻塞
        $lockName = sprintf(AsrRedisKeys::SUMMARY_LOCK, md5($userId . ':' . $summaryRequest->taskKey));
        $lockOwner = sprintf('%s:%s:%s', $userId, $summaryRequest->taskKey, microtime(true));
        $locked = $this->locker->spinLock($lockName, $lockOwner, AsrConfig::SUMMARY_LOCK_TTL);
        if (! $locked) {
            $this->logger->warning('获取总结任务锁失败，跳过本次处理', [
                'task_key' => $summaryRequest->taskKey,
                'user_id' => $userId,
            ]);
            return;
        }
        try {
            // 1. 准备任务状态
            if ($summaryRequest->hasFileId()) {
                $taskStatus = $this->createVirtualTaskStatusFromFileId($summaryRequest, $userId, $organizationCode);
            } else {
                $taskStatus = $this->validationService->validateTaskStatus($summaryRequest->taskKey, $userId);
            }

            // 2. 使用 Redis 中保存的 topic_id 获取话题及会话信息
            $topicEntity = $this->validationService->validateTopicOwnership((int) $taskStatus->topicId, $userId);
            $chatTopicId = $topicEntity->getChatTopicId();
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

            // 3. 准备任务状态的后续处理
            if (! $summaryRequest->hasFileId()) {
                // 3.1 幂等性检查：如果总结已完成，直接返回（只发送消息，不重复处理）
                if ($taskStatus->isSummaryCompleted()) {
                    $this->logger->info('检测到总结已完成，跳过重复处理', [
                        'task_key' => $summaryRequest->taskKey,
                        'audio_file_id' => $taskStatus->audioFileId,
                        'status' => $taskStatus->status->value,
                    ]);
                    return;
                }

                // 3.2 如果录音未停止，先执行录音终止逻辑
                if (in_array($taskStatus->recordingStatus, [
                    AsrRecordingStatusEnum::START->value,
                    AsrRecordingStatusEnum::RECORDING->value,
                    AsrRecordingStatusEnum::PAUSED->value,
                ], true)) {
                    $this->logger->info('summary 触发录音终止', [
                        'task_key' => $summaryRequest->taskKey,
                        'old_status' => $taskStatus->recordingStatus,
                    ]);
                    $taskStatus->recordingStatus = AsrRecordingStatusEnum::STOPPED->value;
                    $taskStatus->isPaused = false;
                    $this->asrTaskDomainService->saveTaskStatus($taskStatus);
                    $this->asrTaskDomainService->deleteTaskHeartbeat($taskStatus->taskKey, $taskStatus->userId);
                }

                $existingWorkspaceFilePath = $taskStatus->filePath;

                try {
                    // ===== Step 1: Business Logic - Show project =====
                    $projectShown = $this->audioProjectDomainService->showProjectIfExists((int) $summaryRequest->projectId);
                    if ($projectShown) {
                        $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $summaryRequest->projectId);
                        $this->eventDispatcher->dispatch(new ProjectHiddenStatusUpdatedEvent(
                            $projectEntity->getId(),
                            $userId,
                            $organizationCode,
                            $projectEntity->getProjectMode(),
                            false
                        ));
                    }

                    // ===== Step 2: State Management - Start merging phase =====
                    $this->asrTaskDomainService->startMergingPhase($taskStatus);

                    // 先生成新的显示目录路径并更新到 taskStatus（确保沙箱使用正确的目录）
                    if (! empty($summaryRequest->generatedTitle)) {
                        $newDisplayDirectory = $this->directoryService->getNewDisplayDirectory(
                            $taskStatus,
                            $summaryRequest->generatedTitle,
                            $this->titleGeneratorService
                        );
                        $taskStatus->displayDirectory = $newDisplayDirectory;
                    }

                    // 调用沙箱合并音频（沙箱会重命名目录但不会通知文件变动）
                    $this->updateAudioFromSandbox($taskStatus, $organizationCode, $summaryRequest->generatedTitle);

                    // ===== Step 3: Business Logic - Update recording metadata =====
                    $audioFileId = ! empty($taskStatus->audioFileId) ? (int) $taskStatus->audioFileId : null;
                    $this->audioProjectDomainService->updateRecordingMetadata(
                        (int) $summaryRequest->projectId,
                        null,
                        null,
                        'recorded',
                        $audioFileId
                    );

                    // ===== Step 4: State Management - Complete merging phase =====
                    $this->asrTaskDomainService->completeMergingPhase($taskStatus);
                } catch (Throwable $mergeException) {
                    // ===== Exception Handling: State Management - Merging failed =====
                    $this->asrTaskDomainService->failMergingPhase($taskStatus, $mergeException->getMessage());

                    // 回退到已有文件
                    if (! empty($existingWorkspaceFilePath)) {
                        $this->logger->warning('沙箱合并失败，回退使用已有工作区文件', [
                            'task_key' => $summaryRequest->taskKey,
                            'file_path' => $existingWorkspaceFilePath,
                            'error' => $mergeException->getMessage(),
                        ]);
                        $taskStatus->filePath = $existingWorkspaceFilePath;
                    } else {
                        throw $mergeException;
                    }
                }
            }

            // ===== Step 5: State Management - Start summarizing phase =====
            $this->asrTaskDomainService->startSummarizingPhase($taskStatus);

            // 4. 发送总结消息
            $processSummaryTaskDTO = new ProcessSummaryTaskDTO(
                $taskStatus,
                $organizationCode,
                $summaryRequest->projectId,
                $userId,
                $taskStatus->topicId,
                $chatTopicId,
                $conversationId,
                $summaryRequest->modelId
            );

            $userAuthorization = $this->getUserAuthorizationFromUserId($userId);
            $this->sendSummaryChatMessage($processSummaryTaskDTO, $userAuthorization);

            // 5. 标记任务为已完成（幂等性保证）
            $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
            $taskStatus->recordingStatus = AsrRecordingStatusEnum::STOPPED->value;

            // 6. 保存任务状态
            $this->asrTaskDomainService->saveTaskStatus($taskStatus);

            // 6.1 总结完成后显影显示目录（上传阶段 display_dir 先隐藏）
            if (! empty($taskStatus->displayDirectoryId)) {
                try {
                    $this->directoryService->showDirectoryById((int) $taskStatus->displayDirectoryId);
                } catch (Throwable $e) {
                    $this->logger->warning('总结完成后显影显示目录失败', [
                        'task_key' => $summaryRequest->taskKey,
                        'display_directory_id' => $taskStatus->displayDirectoryId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Note: Do NOT call completeSummarizingPhaseIfExists here
            // The AI task is asynchronous, the actual completion status will be set by RunTaskCallbackEventSubscriber
            // when the AI task really finishes (success/failure)

            // 7. 清理流式识别文件（总结完成后不再需要）
            if (! empty($taskStatus->presetTranscriptFileId)) {
                try {
                    $this->presetFileService->deleteTranscriptFile($taskStatus->presetTranscriptFileId);
                } catch (Throwable $e) {
                    $this->logger->warning('总结完成后清理流式识别文件失败', [
                        'task_key' => $summaryRequest->taskKey,
                        'preset_transcript_file_id' => $taskStatus->presetTranscriptFileId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $this->logger->info('总结任务完成', [
                'task_key' => $summaryRequest->taskKey,
                'audio_file_id' => $taskStatus->audioFileId,
                'status' => $taskStatus->status->value,
            ]);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 验证项目权限.
     */
    public function validateProjectAccess(string $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        return $this->validationService->getAccessibleProjectWithEditor((int) $projectId, $userId, $organizationCode);
    }

    /**
     * 获取音频项目配置的模型ID.
     */
    public function getAudioProjectModelId(string $projectId): ?string
    {
        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId((int) $projectId);
        return $audioProject?->getModelId();
    }

    /**
     * 从Redis获取任务状态.
     */
    public function getTaskStatusFromRedis(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        $taskStatus = $this->asrTaskDomainService->findTaskByKey($taskKey, $userId);
        return $taskStatus ?? new AsrTaskStatusDTO();
    }

    /**
     * 保存任务状态到Redis.
     */
    public function saveTaskStatusToRedis(AsrTaskStatusDTO $taskStatus, int $ttl = AsrConfig::TASK_STATUS_TTL): void
    {
        $this->asrTaskDomainService->saveTaskStatus($taskStatus, $ttl);
    }

    /**
     * Delete task heartbeat.
     */
    public function deleteTaskHeartbeat(string $taskKey, string $userId): void
    {
        $this->asrTaskDomainService->deleteTaskHeartbeat($taskKey, $userId);
    }

    /**
     * 准备录音目录.
     */
    public function prepareRecordingDirectories(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $taskKey,
        ?string $generatedTitle = null
    ): array {
        $hiddenDir = $this->directoryService->createHiddenDirectory($organizationCode, $projectId, $userId, $taskKey);
        $displayDir = $this->directoryService->createDisplayDirectory($organizationCode, $projectId, $userId, $generatedTitle);
        return [$hiddenDir, $displayDir];
    }

    /**
     * 从话题获取项目ID.
     */
    public function getProjectIdFromTopic(int $topicId, string $userId): string
    {
        return $this->validationService->getProjectIdFromTopic($topicId, $userId);
    }

    /**
     * 验证话题并准备录音目录.
     */
    public function validateTopicAndPrepareDirectories(
        string $topicId,
        string $projectId,
        string $userId,
        string $organizationCode,
        string $taskKey,
        ?string $generatedTitle = null
    ): array {
        // 验证话题和项目权限
        $this->validationService->validateTopicOwnership((int) $topicId, $userId);
        // $this->validationService->validateProjectAccess($projectId, $userId, $organizationCode);
        $this->validationService->getAccessibleProjectWithEditor((int) $projectId, $userId, $organizationCode);

        // 准备录音目录
        return $this->prepareRecordingDirectories($organizationCode, $projectId, $userId, $taskKey, $generatedTitle);
    }

    /**
     * 处理录音状态上报.
     */
    public function handleStatusReport(
        string $taskKey,
        AsrRecordingStatusEnum $status,
        string $modelId,
        string $asrStreamContent,
        ?string $noteContent,
        ?string $noteFileType,
        ?string $markerContent,
        string $language,
        string $userId,
        string $organizationCode
    ): bool {
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            ExceptionBuilder::throw(AsrErrorCode::TaskNotExist);
        }

        // 保存 model_id、ASR 内容、笔记内容、标记内容和语种
        $this->updateTaskStatusFromReport($taskStatus, $modelId, $asrStreamContent, $noteContent, $noteFileType, $markerContent, $language);

        // 根据状态处理
        return match ($status) {
            AsrRecordingStatusEnum::START => $this->handleStartRecording($taskStatus, $userId, $organizationCode),
            AsrRecordingStatusEnum::RECORDING => $this->handleRecordingHeartbeat($taskStatus, $userId, $organizationCode),
            AsrRecordingStatusEnum::PAUSED => $this->handlePauseRecording($taskStatus),
            AsrRecordingStatusEnum::STOPPED => $this->handleStopRecording($taskStatus),
            AsrRecordingStatusEnum::CANCELED => $this->handleCancelRecording($taskStatus),
        };
    }

    /**
     * 自动触发总结（用于心跳超时定时任务）.
     */
    public function autoTriggerSummary(AsrTaskStatusDTO $taskStatus, string $userId, string $organizationCode): void
    {
        // 锁维度：user_id + task_key，避免不同用户 task_key 碰撞互相阻塞
        $lockName = sprintf(AsrRedisKeys::SUMMARY_LOCK, md5($userId . ':' . $taskStatus->taskKey));
        $lockOwner = sprintf('%s:%s:%s', $userId, $taskStatus->taskKey, microtime(true));
        $locked = $this->locker->spinLock($lockName, $lockOwner, AsrConfig::SUMMARY_LOCK_TTL);
        if (! $locked) {
            $this->logger->warning('获取自动总结锁失败，跳过本次处理', [
                'task_key' => $taskStatus->taskKey,
                'user_id' => $userId,
            ]);
            return;
        }
        try {
            // 幂等性检查：如果总结已完成，跳过处理
            if ($taskStatus->isSummaryCompleted()) {
                $this->logger->info('检测到自动总结已完成，跳过重复处理', [
                    'task_key' => $taskStatus->taskKey,
                    'audio_file_id' => $taskStatus->audioFileId,
                    'status' => $taskStatus->status->value,
                ]);
                return;
            }

            if ($taskStatus->serverSummaryRetryCount >= AsrConfig::SERVER_SUMMARY_MAX_RETRY) {
                $this->logger->warning('自动总结重试次数达到上限，跳过本次处理', [
                    'task_key' => $taskStatus->taskKey,
                    'retry_count' => $taskStatus->serverSummaryRetryCount,
                    'max_retry' => AsrConfig::SERVER_SUMMARY_MAX_RETRY,
                ]);
                return;
            }

            $taskStatus->markServerSummaryAttempt();
            $this->asrTaskDomainService->saveTaskStatus($taskStatus);

            $this->logger->info('开始自动总结', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
            ]);

            // 生成标题
            $fileTitle = $this->titleGeneratorService->generateFromTaskStatus($taskStatus);

            // 先生成新的显示目录路径并更新到 taskStatus（确保沙箱使用正确的目录）
            if (! empty($fileTitle)) {
                $newDisplayDirectory = $this->directoryService->getNewDisplayDirectory(
                    $taskStatus,
                    $fileTitle,
                    $this->titleGeneratorService
                );
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }

            // ===== Phase 1: 状态管理 - 开始合并 =====
            $this->asrTaskDomainService->startMergingPhase($taskStatus);

            // 合并音频（沙箱会重命名目录但不会通知文件变动）
            $this->asrSandboxService->mergeAudioFiles($taskStatus, $fileTitle, $organizationCode, AsrTaskStatusEnum::COMPLETED);

            // ===== Phase 1: 状态管理 - 完成合并 =====
            $this->asrTaskDomainService->completeMergingPhase($taskStatus);

            // ===== Phase 2: 状态管理 - 开始总结 =====
            $this->asrTaskDomainService->startSummarizingPhase($taskStatus);

            // 发送聊天消息
            $this->sendAutoSummaryChatMessage($taskStatus, $userId, $organizationCode);

            // Note: Do NOT call completeSummarizingPhase here
            // ⚠️ 总结完成状态由 RunTaskCallbackEventSubscriber 在 AI 任务真正完成时设置

            $taskStatus->finishServerSummaryAttempt(true);

            // 标记任务为已完成（指录音处理完成，不是 AI 总结完成）
            $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
            $taskStatus->recordingStatus = AsrRecordingStatusEnum::STOPPED->value;
            $this->asrTaskDomainService->saveTaskStatus($taskStatus);

            // 自动总结完成后显影显示目录
            if (! empty($taskStatus->displayDirectoryId)) {
                try {
                    $this->directoryService->showDirectoryById((int) $taskStatus->displayDirectoryId);
                } catch (Throwable $e) {
                    $this->logger->warning('自动总结完成后显影显示目录失败', [
                        'task_key' => $taskStatus->taskKey,
                        'display_directory_id' => $taskStatus->displayDirectoryId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // 清理流式识别文件（总结完成后不再需要）
            if (! empty($taskStatus->presetTranscriptFileId)) {
                try {
                    $this->presetFileService->deleteTranscriptFile($taskStatus->presetTranscriptFileId);
                } catch (Throwable $e) {
                    $this->logger->warning('自动总结完成后清理流式识别文件失败', [
                        'task_key' => $taskStatus->taskKey,
                        'preset_transcript_file_id' => $taskStatus->presetTranscriptFileId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $this->logger->info('自动总结任务已触发', [
                'task_key' => $taskStatus->taskKey,
                'audio_file_id' => $taskStatus->audioFileId,
            ]);
        } catch (Throwable $e) {
            $taskStatus->finishServerSummaryAttempt(false);

            // ===== Exception Handling: State Management - Mark current phase as failed =====
            if ($taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_MERGING) {
                $this->asrTaskDomainService->failMergingPhase($taskStatus, $e->getMessage());
            } elseif ($taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_SUMMARIZING) {
                $this->asrTaskDomainService->failSummarizingPhase($taskStatus, $e->getMessage());
            }

            $this->logger->error('自动总结失败', [
                'task_key' => $taskStatus->taskKey,
                'current_phase' => $taskStatus->currentPhase,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * Query task progress (Redis + Database hybrid query).
     */
    public function getTaskProgress(string $taskKey, string $userId): array
    {
        // 1. Get task status with automatic fallback (Redis → Database)
        $taskStatus = $this->asrTaskDomainService->getTaskStatus($taskKey, $userId);

        // 2. Get audio project from database (supplementary data - 10%)
        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId(
            (int) $taskStatus->projectId
        );

        if ($audioProject === null) {
            ExceptionBuilder::throw(AsrErrorCode::ProjectNotExist);
        }

        // 3. Build response (mainly from Redis, supplemented by database)
        return [
            'task_key' => $taskKey,
            'project_id' => $taskStatus->projectId,

            // Configuration (from database)
            'auto_summary' => $audioProject->isAutoSummary(),

            // Task status (from Redis) - Core info
            'recording_status' => $taskStatus->recordingStatus ?? 'pending',
            'task_status' => $taskStatus->status->value,

            // Current phase info (each phase independent 0-100%)
            'current_phase' => $taskStatus->currentPhase,           // merging|summarizing|null
            'phase_status' => $taskStatus->phaseStatus,             // in_progress|completed|failed|null
            'phase_percent' => $taskStatus->phasePercent,           // 0-100 (current phase progress)
            'phase_error' => $taskStatus->phaseError,               // error message if failed

            // File info (from Redis + database)
            'audio_file_id' => $taskStatus->audioFileId,
            'audio_file_path' => $taskStatus->filePath,
            'duration_seconds' => $audioProject->getDuration(),        // From database
            'file_size_bytes' => $audioProject->getFileSize(),         // From database

            // Topic and model info
            'topic_id' => $audioProject->getTopicId(),
            'model_id' => $taskStatus->modelId ?? $audioProject->getModelId(),

            // Operation permissions (calculated from Redis status)
            'can_finish_recording' => $taskStatus->canManualFinishRecording(),
            'can_summarize' => $taskStatus->canManualSummarize(),
        ];
    }

    /**
     * Manually trigger summary.
     */
    public function triggerSummary(
        string $taskKey,
        string $topicId,
        ?string $modelId,
        MagicUserAuthorization $userAuthorization
    ): array {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // ===== Step 1: State Query (with automatic fallback) =====
        $taskStatus = $this->asrTaskDomainService->getTaskStatus($taskKey, $userId);

        // Get audio project
        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId(
            (int) $taskStatus->projectId
        );

        if ($audioProject === null) {
            ExceptionBuilder::throw(AsrErrorCode::ProjectNotExist);
        }

        // Validate status
        if (! $this->canManualSummarize($taskStatus, $audioProject)) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        // Resolve effective model id:
        // request model_id > task status model_id > audio project model_id.
        $effectiveModelId = $modelId;
        if (empty($effectiveModelId)) {
            $effectiveModelId = $taskStatus->modelId;
        }
        if (empty($effectiveModelId)) {
            $effectiveModelId = $audioProject->getModelId();
        }
        if (empty($effectiveModelId)) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterMissing,
                $this->translator->trans('asr.api.validation.model_id_required')
            );
        }

        // ===== Step 2: Business Logic - Update topic and model =====
        if (! empty($topicId)) {
            $this->audioProjectDomainService->updateTopicAndModel(
                (int) $taskStatus->projectId,
                (int) $topicId,
                $effectiveModelId
            );
        }

        // ===== Step 3: Update Redis config =====
        if (! empty($topicId)) {
            $taskStatus->topicId = $topicId;
        }
        $taskStatus->modelId = $effectiveModelId;
        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        // ===== Step 4: State Management - Start summarizing phase =====
        $this->asrTaskDomainService->startSummarizingPhase($taskStatus);

        // Async trigger summary
        $this->sendAutoSummaryChatMessage($taskStatus, $userId, $organizationCode);

        // Mark as completed
        $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'summary' => [
                'status' => 'in_progress',
                'topic_id' => $taskStatus->topicId,
                'model_id' => $taskStatus->modelId,
            ],
            'message' => 'Summary is being generated, you will receive updates via WebSocket',
        ];
    }

    /**
     * Batch trigger summary for multiple tasks.
     * Each task uses its own topic_id from task status.
     * For model_id: prioritize task's own model_id, fallback to batch parameter.
     */
    public function batchTriggerSummary(
        array $taskKeys,
        ?string $modelId,
        MagicUserAuthorization $userAuthorization
    ): array {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $results = [];
        $successCount = 0;
        $failedCount = 0;

        // Batch query task status with permission validation.
        $taskStatusMap = $this->asrTaskDomainService->batchGetTaskStatus($taskKeys, $userId, $organizationCode);

        // Batch load audio project entities to avoid N queries.
        $projectIds = [];
        foreach ($taskKeys as $taskKey) {
            $taskStatus = $taskStatusMap[$taskKey] ?? null;
            if ($taskStatus instanceof AsrTaskStatusDTO && ! empty($taskStatus->projectId)) {
                $projectIds[] = (int) $taskStatus->projectId;
            }
        }
        $audioProjectMap = $this->audioProjectDomainService->getAudioProjectsByProjectIds(
            array_values(array_unique($projectIds))
        );

        foreach ($taskKeys as $taskKey) {
            try {
                // Security: unknown/unauthorized task keys are treated uniformly as failed.
                $taskStatus = $taskStatusMap[$taskKey] ?? null;
                if (! $taskStatus instanceof AsrTaskStatusDTO || empty($taskStatus->projectId)) {
                    throw new RuntimeException('Task status is not accessible');
                }

                $projectId = (int) $taskStatus->projectId;
                $audioProject = $audioProjectMap[$projectId] ?? null;
                if (! $audioProject instanceof AudioProjectEntity) {
                    throw new RuntimeException('Audio project not found');
                }

                $audioSource = $audioProject->getAudioSource();
                if ($audioSource === 'imported') {
                    // Imported projects: summary by file_id path.
                    $result = $this->triggerImportedSummaryForBatch(
                        $taskKey,
                        $taskStatus,
                        $audioProject,
                        $userAuthorization
                    );
                } else {
                    if (empty($taskStatus->topicId)) {
                        throw new RuntimeException('Topic ID is required');
                    }

                    // Recorded projects: keep original behavior and model fallback.
                    $effectiveModelId = $taskStatus->modelId ?? $modelId;
                    $result = $this->triggerSummary(
                        $taskKey,
                        $taskStatus->topicId,
                        $effectiveModelId,
                        $userAuthorization
                    );
                }

                $results[] = array_merge(['task_key' => $taskKey], $result);
                ++$successCount;
            } catch (Throwable $e) {
                // Catch individual task errors
                $this->logger->warning('Batch summary failed for task', [
                    'task_key' => $taskKey,
                    'user_id' => $userId,
                    'org_code' => $organizationCode,
                    'error' => $e->getMessage(),
                    'error_code' => $e->getCode(),
                ]);

                // Security requirement: hide error details for unauthorized/non-existent/invalid tasks.
                $results[] = $this->buildBatchSummaryFailedResult($taskKey);
                ++$failedCount;
            }
        }

        $this->logger->info('Batch summary completed', [
            'user_id' => $userId,
            'total' => count($taskKeys),
            'success_count' => $successCount,
            'failed_count' => $failedCount,
        ]);

        return [
            'total' => count($taskKeys),
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'results' => $results,
            'message' => sprintf(
                'Batch summary triggered: %d succeeded, %d failed',
                $successCount,
                $failedCount
            ),
        ];
    }

    /**
     * Async trigger finish recording (immediately return, execute in background).
     */
    public function triggerFinishRecordingAsync(
        string $taskKey,
        string $userId,
        string $organizationCode,
        ?string $generatedTitle = null
    ): array {
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            ExceptionBuilder::throw(AsrErrorCode::TaskNotExist);
        }

        // Validate status
        if (! $taskStatus->canManualFinishRecording()) {
            // Log current task status for debugging
            $this->logger->warning('Task status validation failed for finish recording', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'recording_status' => $taskStatus->recordingStatus,
                'task_status' => $taskStatus->status,
                'current_phase' => $taskStatus->currentPhase,
                'phase_status' => $taskStatus->phaseStatus,
                'audio_file_id' => $taskStatus->audioFileId,
                'can_finish_recording' => $taskStatus->canManualFinishRecording(),
                'expected_conditions' => [
                    'recording_status_should_be' => AsrRecordingStatusEnum::STOPPED->value,
                    'audio_file_id_should_be_empty' => true,
                    'current_phase_should_not_be' => AsrTaskStatusDTO::PHASE_MERGING,
                ],
            ]);

            // Already in progress, return current status
            if ($taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_MERGING) {
                return [
                    'success' => true,
                    'task_key' => $taskKey,
                    'phase' => $taskStatus->currentPhase,
                    'status' => $taskStatus->phaseStatus,
                    'percent' => $taskStatus->phasePercent,
                    'message' => 'Finish recording is already in progress',
                ];
            }
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        // Mark as in progress (phase starts from 0%)
        $taskStatus->currentPhase = AsrTaskStatusDTO::PHASE_MERGING;
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS;
        $taskStatus->phasePercent = 0;
        $taskStatus->phaseError = null;
        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        // Execute async
        $this->executeAsyncFinishRecording($taskStatus, $organizationCode, $generatedTitle);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'phase' => AsrTaskStatusDTO::PHASE_MERGING,
            'status' => AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS,
            'percent' => 0,
            'message' => 'Finish recording started, query progress via GET /asr/tasks/{task_key}/progress',
        ];
    }

    /**
     * Handle finish recording logic (can be called by API or cron).
     */
    public function handleFinishRecording(
        string $taskKey,
        string $userId,
        string $organizationCode,
        ?string $generatedTitle = null
    ): void {
        $lockName = sprintf(AsrRedisKeys::FINISH_RECORDING_LOCK, $taskKey);
        $lockOwner = sprintf('%s:%s:%s', $userId, $taskKey, microtime(true));
        $locked = $this->locker->spinLock($lockName, $lockOwner, AsrConfig::FINISH_RECORDING_LOCK_TTL);

        if (! $locked) {
            $this->logger->warning('Failed to acquire finish recording lock', [
                'task_key' => $taskKey,
            ]);
            return;
        }

        try {
            $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

            // Idempotent check
            if ($taskStatus->phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_COMPLETED
                && $taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_MERGING) {
                $this->logger->info('Finish recording already completed', [
                    'task_key' => $taskKey,
                ]);
                return;
            }

            // ===== Step 1: Business Logic - Show project =====
            $projectShown = $this->audioProjectDomainService->showProjectIfExists((int) $taskStatus->projectId);
            if ($projectShown) {
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $taskStatus->projectId);
                $this->eventDispatcher->dispatch(new ProjectHiddenStatusUpdatedEvent(
                    $projectEntity->getId(),
                    $userId,
                    $organizationCode,
                    $projectEntity->getProjectMode(),
                    false
                ));
            }

            // ===== Step 2: State Management - Start merging phase =====
            $this->asrTaskDomainService->startMergingPhase($taskStatus);

            // Update progress: 10%
            $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 10);

            // finish-recording 与 /summary 行为不同：不改显示目录，只用于合并文件命名
            $effectiveTitle = $generatedTitle;
            if (empty($effectiveTitle)) {
                $effectiveTitle = $taskStatus->uploadGeneratedTitle;
            }

            // Execute merge
            $fileTitle = $this->titleGeneratorService->sanitizeTitle($effectiveTitle ?? '');
            if ($fileTitle === '') {
                $fileTitle = $this->translator->trans('asr.file_names.original_recording');
            }

            // Update progress: 50%
            $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 50);

            $mergeResult = $this->asrSandboxService->mergeAudioFiles(
                $taskStatus,
                $fileTitle,
                $organizationCode,
                AsrTaskStatusEnum::AUDIO_PROCESSED
            );

            // Update progress: 80%
            $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 80);

            // ===== Step 3: Business Logic - Update recording metadata =====
            $audioFileId = ! empty($taskStatus->audioFileId) ? (int) $taskStatus->audioFileId : null;
            $this->audioProjectDomainService->updateRecordingMetadata(
                (int) $taskStatus->projectId,
                $mergeResult->duration,
                $mergeResult->fileSize,
                'recorded',
                $audioFileId
            );

            // ===== Step 4: State Management - Complete merging phase =====
            $this->asrTaskDomainService->completeMergingPhase($taskStatus);

            $this->logger->info('Finish recording completed', [
                'task_key' => $taskKey,
                'audio_file_id' => $taskStatus->audioFileId,
            ]);
        } catch (Throwable $e) {
            // ===== Exception Handling: State Management - Merging failed =====
            $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);
            $this->asrTaskDomainService->failMergingPhase($taskStatus, $e->getMessage());

            $this->logger->error('Finish recording failed', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * Batch query task progress (optimized with Redis Pipeline + Database IN query).
     *
     * Performance:
     * - Redis: Pipeline batch get (1 network round-trip for N tasks)
     * - Database: IN query (1 SQL for N projects)
     * - Expected latency: 100-300ms for 100 tasks
     *
     * Security:
     * - Database query validates user permission via JOIN with project table
     * - Only returns tasks that belong to the specified user
     *
     * @param array $taskKeys Array of task keys
     * @param string $userId User ID
     * @param string $orgCode Organization code
     * @return array Response with batch results
     */
    public function getBatchTaskProgress(array $taskKeys, string $userId, string $orgCode): array
    {
        if (empty($taskKeys)) {
            return ['tasks' => []];
        }

        // Step 1: Batch get task status from Redis (with Pipeline fallback to DB + permission check)
        $taskStatuses = $this->asrTaskDomainService->batchGetTaskStatus($taskKeys, $userId, $orgCode);

        // Step 2: Collect unique project IDs for database query
        $projectIds = [];
        foreach ($taskStatuses as $taskStatus) {
            if ($taskStatus !== null && ! empty($taskStatus->projectId)) {
                $projectIds[] = (int) $taskStatus->projectId;
            }
        }

        // Step 3: Batch query audio projects from database (single IN query)
        $audioProjects = [];
        if (! empty($projectIds)) {
            $uniqueProjectIds = array_unique($projectIds);
            $audioProjects = $this->audioProjectDomainService->getAudioProjectsByProjectIds($uniqueProjectIds);
        }

        // Step 4: Build response for each task
        $results = [];

        foreach ($taskKeys as $taskKey) {
            $taskStatus = $taskStatuses[$taskKey] ?? null;

            // Case 1: Task not found in Redis or Database (or no permission)
            if ($taskStatus === null || $taskStatus->isEmpty()) {
                $results[] = [
                    'task_key' => $taskKey,
                    'exists' => false,
                    'error' => 'Task not found or no permission',
                ];
                continue;
            }

            // Case 2: Task exists but audio project not found
            $audioProject = null;
            if (! empty($taskStatus->projectId)) {
                $audioProject = $audioProjects[(int) $taskStatus->projectId] ?? null;
            }

            if ($audioProject === null) {
                $results[] = [
                    'task_key' => $taskKey,
                    'exists' => true,
                    'error' => 'Audio project not found',
                    'project_id' => $taskStatus->projectId,
                    'recording_status' => $taskStatus->recordingStatus ?? 'unknown',
                    'task_status' => $taskStatus->status->value ?? 'unknown',
                ];
                continue;
            }

            // Case 3: Complete data available
            $results[] = [
                'task_key' => $taskKey,
                'exists' => true,
                'project_id' => $taskStatus->projectId,

                // Configuration (from database)
                'auto_summary' => $audioProject->isAutoSummary(),

                // Task status (from Redis) - Real-time info
                'recording_status' => $taskStatus->recordingStatus ?? 'pending',
                'task_status' => $taskStatus->status->value,

                // Current phase info (from Redis)
                'current_phase' => $taskStatus->currentPhase,
                'phase_status' => $taskStatus->phaseStatus,
                'phase_percent' => $taskStatus->phasePercent,
                'phase_error' => $taskStatus->phaseError,

                // File info (Redis + Database hybrid)
                'audio_file_id' => $taskStatus->audioFileId,
                'audio_file_path' => $taskStatus->filePath,
                'duration_seconds' => $audioProject->getDuration(),
                'file_size_bytes' => $audioProject->getFileSize(),

                // Topic and model info (from Database)
                'topic_id' => $audioProject->getTopicId(),
                'model_id' => $taskStatus->modelId ?? $audioProject->getModelId(),

                // Operation permissions (calculated from Redis status)
                'can_finish_recording' => $taskStatus->canManualFinishRecording(),
                'can_summarize' => $taskStatus->canManualSummarize(),
            ];
        }

        return ['tasks' => $results];
    }

    /**
     * Trigger summary for imported project by file_id flow.
     */
    private function triggerImportedSummaryForBatch(
        string $taskKey,
        AsrTaskStatusDTO $taskStatus,
        AudioProjectEntity $audioProject,
        MagicUserAuthorization $userAuthorization
    ): array {
        $fileId = $audioProject->getAudioFileId();
        if ($fileId === null && ! empty($taskStatus->audioFileId)) {
            $fileId = (int) $taskStatus->audioFileId;
        }
        if ($fileId === null) {
            throw new RuntimeException('Audio file id is required for imported summary');
        }

        $topicId = $audioProject->getTopicId();
        if ($topicId === null && ! empty($taskStatus->topicId)) {
            $topicId = (int) $taskStatus->topicId;
        }
        if ($topicId === null) {
            throw new RuntimeException('Topic id is required for imported summary');
        }

        // Imported flow requires explicit model and does not fallback to batch model_id.
        $effectiveModelId = $audioProject->getModelId() ?? $taskStatus->modelId;
        if (empty($effectiveModelId)) {
            throw new RuntimeException('Model id is required for imported summary');
        }

        $summaryRequest = new SummaryRequestDTO(
            taskKey: $taskKey,
            projectId: (string) $taskStatus->projectId,
            topicId: (string) $topicId,
            modelId: $effectiveModelId,
            fileId: (string) $fileId
        );

        $result = $this->processSummaryWithChat($summaryRequest, $userAuthorization);
        if (! ($result['success'] ?? false)) {
            throw new RuntimeException((string) ($result['error'] ?? 'Imported summary trigger failed'));
        }

        return $result;
    }

    /**
     * Build security-friendly failed result for batch summary.
     */
    private function buildBatchSummaryFailedResult(string $taskKey): array
    {
        return [
            'task_key' => $taskKey,
            'success' => false,
        ];
    }

    /**
     * 投递总结任务到 MQ（失败则抛错，让客户端可显式重试）.
     */
    private function publishSummaryToMq(SummaryRequestDTO $summaryRequest, MagicUserAuthorization $userAuthorization): void
    {
        $payload = [
            'task_key' => $summaryRequest->taskKey,
            'project_id' => $summaryRequest->projectId,
            'topic_id' => $summaryRequest->topicId,
            'model_id' => $summaryRequest->modelId,
            'file_id' => $summaryRequest->fileId,
            'generated_title' => $summaryRequest->generatedTitle,
            'user_id' => $userAuthorization->getId(),
            'organization_code' => $userAuthorization->getOrganizationCode(),
            'language' => CoContext::getLanguage(),
            'request_id' => CoContext::getRequestId(),
            'retry_count' => 0,
        ];

        $message = AsrSummaryMessage::fromArray($payload);
        $publisher = new AsrSummaryPublisher($message);
        if (! $this->producer->produce($publisher)) {
            $this->logger->error('投递 ASR 总结 MQ 失败', [
                'task_key' => $summaryRequest->taskKey,
                'user_id' => $userAuthorization->getId(),
            ]);
            ExceptionBuilder::throw(AsrErrorCode::SystemBusy);
        }
    }

    /**
     * 获取项目和工作区名称.
     */
    private function getProjectAndWorkspaceNames(string $projectId): array
    {
        try {
            $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            if ($projectEntity === null) {
                return [null, null];
            }

            $projectName = $projectEntity->getProjectName();
            $workspaceId = $projectEntity->getWorkspaceId();
            $workspaceName = null;
            if ($workspaceId !== null) {
                $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
                $workspaceName = $workspaceEntity?->getName();
            }

            return [$projectName, $workspaceName];
        } catch (Throwable $e) {
            $this->logger->warning('查询项目或工作区信息失败', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            return [null, null];
        }
    }

    /**
     * 判断是否需要更新名称.
     */
    private function shouldUpdateNames(?string $projectName, ?string $topicName): bool
    {
        return empty(trim($projectName ?? '')) || empty(trim($topicName ?? ''));
    }

    /**
     * 更新空的项目和话题名称.
     */
    private function updateEmptyProjectAndTopicNames(
        string $projectId,
        int $topicId,
        string $generatedTitle,
        string $userId,
        string $organizationCode
    ): void {
        try {
            // 更新项目名称
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            if (empty(trim($projectEntity->getProjectName() ?? ''))) {
                $projectEntity->setProjectName($generatedTitle);
                $projectEntity->setUpdatedUid($userId);
                $this->projectDomainService->saveProjectEntity($projectEntity);
            }

            // 更新话题名称
            $topicEntity = $this->superAgentTopicDomainService->getTopicById($topicId);
            if ($topicEntity && empty(trim($topicEntity->getTopicName() ?? ''))) {
                $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
                $this->superAgentTopicDomainService->updateTopic($dataIsolation, $topicId, $generatedTitle);
            }
        } catch (Throwable $e) {
            $this->logger->warning('更新项目/话题名称失败', [
                'project_id' => $projectId,
                'topic_id' => $topicId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 从文件ID创建虚拟任务状态.
     *
     * @param null|AsrTaskStatusEnum $initialStatus 初始状态，默认为 COMPLETED
     */
    private function createVirtualTaskStatusFromFileId(
        SummaryRequestDTO $summaryRequest,
        string $userId,
        string $organizationCode,
        ?AsrTaskStatusEnum $initialStatus = null
    ): AsrTaskStatusDTO {
        $fileEntity = $this->taskFileDomainService->getById((int) $summaryRequest->fileId);

        if ($fileEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::FileNotExist, '', ['fileId' => $summaryRequest->fileId]);
        }

        if ((string) $fileEntity->getProjectId() !== $summaryRequest->projectId) {
            ExceptionBuilder::throw(AsrErrorCode::FileNotBelongToProject, '', ['fileId' => $summaryRequest->fileId]);
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($fileEntity->getFileKey());

        return new AsrTaskStatusDTO([
            'task_key' => $summaryRequest->taskKey,
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'status' => ($initialStatus ?? AsrTaskStatusEnum::COMPLETED)->value,
            'file_path' => $workspaceRelativePath,
            'audio_file_id' => $summaryRequest->fileId,
            'project_id' => $summaryRequest->projectId,
            'topic_id' => $summaryRequest->topicId,
        ]);
    }

    /**
     * 从沙箱更新音频.
     */
    private function updateAudioFromSandbox(
        AsrTaskStatusDTO $taskStatus,
        string $organizationCode,
        ?string $customTitle = null
    ): void {
        $fileTitle = $this->titleGeneratorService->sanitizeTitle($customTitle ?? '');
        if ($fileTitle === '') {
            $fileTitle = $this->translator->trans('asr.file_names.original_recording');
        }

        // Merge audio files and get merge result (includes duration and file_size)
        $mergeResult = $this->asrSandboxService->mergeAudioFiles($taskStatus, $fileTitle, $organizationCode, AsrTaskStatusEnum::COMPLETED);

        // Update audio project extension with duration and file size
        $this->updateAudioProjectDuration($taskStatus, $mergeResult);
    }

    /**
     * Update audio project extension with duration and file size.
     * @param mixed $mergeResult
     */
    private function updateAudioProjectDuration(AsrTaskStatusDTO $taskStatus, $mergeResult): void
    {
        try {
            $projectId = (int) $taskStatus->projectId;
            $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);

            if ($audioProject && $mergeResult) {
                $duration = $mergeResult->duration ?? null;
                $fileSize = $mergeResult->fileSize ?? null;

                if ($duration !== null && $fileSize !== null) {
                    $this->audioProjectDomainService->updateRecordingDuration($audioProject, $duration, $fileSize);

                    $this->logger->info('Audio project duration and file size updated', [
                        'project_id' => $projectId,
                        'duration' => $duration,
                        'file_size' => $fileSize,
                    ]);
                }
            }
        } catch (Throwable $e) {
            // Log error but don't block the main flow
            $this->logger->error('Failed to update audio project duration', [
                'project_id' => $taskStatus->projectId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 根据任务状态构建音频文件数据.
     */
    private function buildFileDataFromTaskStatus(AsrTaskStatusDTO $taskStatus): AsrFileDataDTO
    {
        $fileId = $taskStatus->audioFileId;
        if (empty($fileId)) {
            ExceptionBuilder::throw(AsrErrorCode::AudioFileIdEmpty);
        }

        $fileEntity = $this->taskFileDomainService->getById((int) $fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::FileNotExist, '', ['fileId' => $fileId]);
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($fileEntity->getFileKey());

        return AsrFileDataDTO::fromTaskFileEntity($fileEntity, $workspaceRelativePath);
    }

    /**
     * 根据任务状态构建笔记文件数据.
     */
    private function buildNoteFileDataFromTaskStatus(AsrTaskStatusDTO $taskStatus): ?AsrFileDataDTO
    {
        $noteFileId = $taskStatus->noteFileId;
        if (empty($noteFileId)) {
            return null;
        }

        $fileEntity = $this->taskFileDomainService->getById((int) $noteFileId);
        if ($fileEntity === null) {
            $this->logger->warning('笔记文件不存在', [
                'task_key' => $taskStatus->taskKey,
                'note_file_id' => $noteFileId,
            ]);
            return null;
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($fileEntity->getFileKey());

        return AsrFileDataDTO::fromTaskFileEntity($fileEntity, $workspaceRelativePath);
    }

    /**
     * 构建标记文件数据（从任务状态）.
     */
    private function buildMarkerFileDataFromTaskStatus(AsrTaskStatusDTO $taskStatus): ?AsrFileDataDTO
    {
        $markerFileId = $taskStatus->markerFileId;
        if (empty($markerFileId)) {
            return null;
        }

        $fileEntity = $this->taskFileDomainService->getById((int) $markerFileId);
        if ($fileEntity === null) {
            $this->logger->warning('标记文件不存在', [
                'task_key' => $taskStatus->taskKey,
                'marker_file_id' => $markerFileId,
            ]);
            return null;
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($fileEntity->getFileKey());

        return AsrFileDataDTO::fromTaskFileEntity($fileEntity, $workspaceRelativePath);
    }

    /**
     * 发送总结聊天消息.
     */
    private function sendSummaryChatMessage(ProcessSummaryTaskDTO $dto, MagicUserAuthorization $userAuthorization): void
    {
        $dedupAcquired = false;
        $dedupKey = null;
        try {
            // ===== 总结消息去重：避免 MQ 重试 / 重复投递导致重复发送 =====
            // 维度：user_id + task_key（与 SummarySubscriber 的重试维度保持一致）
            $taskKey = $dto->taskStatus->taskKey ?? '';
            $userId = $dto->taskStatus->userId ?: $userAuthorization->getId();
            if ($taskKey !== '' && $userId !== '') {
                $dedupKey = sprintf(AsrRedisKeys::SUMMARY_CHAT_DEDUP, md5($userId . ':' . $taskKey));
                $dedupAcquired = (bool) $this->redis->set($dedupKey, '1', ['nx', 'ex' => AsrConfig::SUMMARY_CHAT_DEDUP_TTL]);
                if (! $dedupAcquired) {
                    $this->logger->info('检测到总结聊天消息已发送，跳过重复发送', [
                        'task_key' => $taskKey,
                        'user_id' => $userId,
                        'dedup_key' => $dedupKey,
                    ]);
                    return;
                }
            }

            // 构建音频文件数据
            $audioFileData = $this->buildFileDataFromTaskStatus($dto->taskStatus);

            // 构建笔记文件数据（如果存在）
            $noteFileData = $this->buildNoteFileDataFromTaskStatus($dto->taskStatus);

            // 构建标记文件数据（如果存在）
            $markerFileData = $this->buildMarkerFileDataFromTaskStatus($dto->taskStatus);

            // 构建聊天消息（包含笔记文件和标记文件）
            $chatRequest = $this->chatMessageAssembler->buildSummaryMessage($dto, $audioFileData, $noteFileData, $markerFileData);

            // 记录消息详细内容
            $messageData = $chatRequest->getData()->getMessage()->getMagicMessage();

            $this->logger->info('sendSummaryChatMessage 准备发送ASR总结聊天消息', [
                'task_key' => $dto->taskStatus->taskKey,
                'topic_id' => $dto->topicId,
                'conversation_id' => $dto->conversationId,
                'model_id' => $dto->modelId,
                'audio_file_id' => $dto->taskStatus->audioFileId,
                'audio_file_path' => $dto->taskStatus->filePath,
                'note_file_id' => $dto->taskStatus->noteFileId,
                'has_note_file' => $noteFileData !== null,
                'marker_file_id' => $dto->taskStatus->markerFileId,
                'has_marker_file' => $markerFileData !== null,
                'message_content' => $messageData->toArray(),
                'is_queued' => $this->shouldQueueMessage($dto->topicId),
                'language' => CoContext::getLanguage(),
            ]);

            if ($this->shouldQueueMessage($dto->topicId)) {
                $this->queueChatMessage($dto, $chatRequest, $userAuthorization);
            } else {
                $this->magicChatMessageAppService->onChatMessage($chatRequest, $userAuthorization);
            }
        } catch (Throwable $e) {
            // 发送失败：释放去重键，允许后续重试再次尝试发送（避免“一次失败永远不发”）
            if ($dedupAcquired && $dedupKey !== null) {
                try {
                    $this->redis->del($dedupKey);
                } catch (Throwable) {
                    // ignore
                }
            }
            $this->logger->error('发送聊天消息失败', [
                'task_key' => $dto->taskStatus->taskKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 检查是否应该队列处理消息.
     */
    private function shouldQueueMessage(string $topicId): bool
    {
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        $currentStatus = $topicEntity->getCurrentTaskStatus();
        return $currentStatus !== null && $currentStatus === SuperAgentTaskStatus::RUNNING;
    }

    /**
     * 将消息写入队列.
     */
    private function queueChatMessage(ProcessSummaryTaskDTO $dto, ChatRequest $chatRequest, MagicUserAuthorization $userAuthorization): void
    {
        $dataIsolation = DataIsolation::create($userAuthorization->getOrganizationCode(), $userAuthorization->getId());
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $dto->topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::TopicNotExist, '', ['topicId' => $dto->topicId]);
        }

        $messageContent = $chatRequest->getData()->getMessage()->getMagicMessage()->toArray();
        $this->messageQueueDomainService->createMessage(
            $dataIsolation,
            (int) $dto->projectId,
            $topicEntity->getId(),
            $messageContent,
            ChatMessageType::RichText
        );
    }

    /**
     * 从用户ID获取用户授权对象.
     */
    private function getUserAuthorizationFromUserId(string $userId): MagicUserAuthorization
    {
        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::UserNotExist);
        }
        return MagicUserAuthorization::fromUserEntity($userEntity);
    }

    /**
     * 更新任务状态（从状态上报）.
     */
    private function updateTaskStatusFromReport(
        AsrTaskStatusDTO $taskStatus,
        string $modelId,
        string $asrStreamContent,
        ?string $noteContent,
        ?string $noteFileType,
        ?string $markerContent,
        string $language
    ): void {
        if (! empty($modelId)) {
            $taskStatus->modelId = $modelId;
        }

        if (! empty($asrStreamContent)) {
            $taskStatus->asrStreamContent = mb_substr($asrStreamContent, 0, 10000);
        }

        if (! empty($noteContent)) {
            $taskStatus->noteContent = mb_substr($noteContent, 0, 25000);
            $taskStatus->noteFileType = $noteFileType ?? 'md';
        }

        if (! empty($markerContent)) {
            $taskStatus->markerContent = mb_substr($markerContent, 0, 5000);
        }

        if (! empty($language)) {
            $taskStatus->language = $language;
        }
    }

    /**
     * 处理开始录音.
     */
    private function handleStartRecording(AsrTaskStatusDTO $taskStatus, string $userId, string $organizationCode): bool
    {
        // 每次 start 都检查沙箱是否存在，防止沙箱被回收导致音频丢失. 原因：如果暂停超过 20 分钟，沙箱可能被回收，需要重新启动以确保音频实时合并
        $started = false;
        try {
            $this->asrSandboxService->startRecordingTask($taskStatus, $userId, $organizationCode);
            $taskStatus->sandboxRetryCount = 0; // 成功后重置重试次数
            $taskStatus->sandboxEnsureAt = time();
            $started = true;
        } catch (Throwable $e) {
            // 沙箱启动失败时记录日志但继续处理（沙箱可能临时不可用）
            ++$taskStatus->sandboxRetryCount;
            $this->logger->warning('沙箱任务启动失败，将在后续自动重试', [
                'task_key' => $taskStatus->taskKey,
                'retry_count' => $taskStatus->sandboxRetryCount,
                'error' => $e->getMessage(),
            ]);
        }
        // 仅当 startTask 成功时才标记为已创建，避免误触发自动总结
        if ($started) {
            $taskStatus->sandboxTaskCreated = true;
        }
        // 更新状态并设置心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::START->value;
        $taskStatus->isPaused = false;
        $this->asrTaskDomainService->saveTaskStatusWithHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理录音心跳,检测沙箱是否还在实时运行，如果没有则重新拉起。
     */
    private function handleRecordingHeartbeat(AsrTaskStatusDTO $taskStatus, string $userId, string $organizationCode): bool
    {
        // running/recording 上报时：走一遍 start 流程（拉起沙箱、检查工作区可用、startTask），保证沙箱实时合并音频
        // 为避免高频心跳导致频繁 startTask，这里按 60s 节流；但若沙箱信息缺失/未创建/有失败重试，则立即尝试拉起
        $now = time();
        $shouldEnsureSandbox = empty($taskStatus->sandboxId)
            || ! $taskStatus->sandboxTaskCreated
            || $taskStatus->sandboxRetryCount > 0
            || $taskStatus->sandboxEnsureAt <= 0
            || ($now - $taskStatus->sandboxEnsureAt) >= 60;

        if ($shouldEnsureSandbox) {
            $lockName = sprintf('asr:sandbox:ensure:%s:%s', $userId, $taskStatus->taskKey);
            $lockOwner = sprintf('%s:%s', $userId, microtime(true));
            $locked = $this->locker->spinLock($lockName, $lockOwner);
            if ($locked) {
                try {
                    $this->asrSandboxService->startRecordingTask($taskStatus, $userId, $organizationCode);
                    $taskStatus->sandboxRetryCount = 0;
                    $taskStatus->sandboxTaskCreated = true;
                    $taskStatus->sandboxEnsureAt = $now;
                } catch (Throwable $e) {
                    ++$taskStatus->sandboxRetryCount;
                    $this->logger->warning('running/recording 上报时拉起沙箱失败', [
                        'task_key' => $taskStatus->taskKey,
                        'user_id' => $userId,
                        'retry_count' => $taskStatus->sandboxRetryCount,
                        'error' => $e->getMessage(),
                    ]);
                } finally {
                    $this->locker->release($lockName, $lockOwner);
                }
            }
        }

        // 更新状态并设置心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::RECORDING->value;
        $taskStatus->isPaused = false;
        $this->asrTaskDomainService->saveTaskStatusWithHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理暂停录音.
     */
    private function handlePauseRecording(AsrTaskStatusDTO $taskStatus): bool
    {
        // 更新状态并删除心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::PAUSED->value;
        $taskStatus->isPaused = true;
        $this->asrTaskDomainService->saveTaskStatusAndDeleteHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理停止录音.
     */
    private function handleStopRecording(AsrTaskStatusDTO $taskStatus): bool
    {
        // 幂等性检查：如果录音已停止，跳过重复处理
        if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::STOPPED->value) {
            $this->logger->info('录音已停止，跳过重复处理', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return true;
        }

        // 更新状态并删除心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::STOPPED->value;
        $this->asrTaskDomainService->saveTaskStatusAndDeleteHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理取消录音.
     */
    private function handleCancelRecording(AsrTaskStatusDTO $taskStatus): bool
    {
        // 幂等性检查：如果录音已取消，跳过重复处理
        if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::CANCELED->value) {
            $this->logger->info('录音已取消，跳过重复处理', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return true;
        }

        $this->logger->info('开始处理取消录音', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
        ]);

        // 调用沙箱取消任务（如果沙箱任务已创建）
        if ($taskStatus->sandboxTaskCreated && ! empty($taskStatus->sandboxId)) {
            try {
                $response = $this->asrSandboxService->cancelRecordingTask($taskStatus);
                $this->logger->info('沙箱录音任务已取消', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $taskStatus->sandboxId,
                    'response_status' => $response->getStatus(),
                ]);
            } catch (Throwable $e) {
                // 沙箱取消失败不阻止本地清理
                $this->logger->warning('沙箱取消任务失败，继续本地清理', [
                    'task_key' => $taskStatus->taskKey,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // 更新状态为取消并删除心跳
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::CANCELED->value;
        $this->asrTaskDomainService->saveTaskStatusAndDeleteHeartbeat($taskStatus);

        // 准备 DataIsolation 对象（用于删除目录）
        $dataIsolation = DataIsolation::simpleMake(
            $taskStatus->organizationCode,
            $taskStatus->userId
        );

        // 获取项目信息（用于获取 workDir）
        $workDir = '';
        $projectOrganizationCode = $taskStatus->organizationCode;
        try {
            $projectEntity = $this->getAccessibleProjectWithEditor((int) $taskStatus->projectId, $taskStatus->userId, $taskStatus->organizationCode);
            $workDir = $projectEntity->getWorkDir();
            $projectOrganizationCode = $projectEntity->getUserOrganizationCode();
        } catch (Throwable $e) {
            $this->logger->warning('获取项目信息失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'error' => $e->getMessage(),
            ]);
        }

        // 清理隐藏目录（包含目录下的所有文件，包括预设文件）
        if (! empty($taskStatus->tempHiddenDirectoryId) && ! empty($taskStatus->tempHiddenDirectory)) {
            try {
                if (! empty($workDir)) {
                    // 使用 deleteDirectoryFiles 级联删除目录及其所有子文件
                    $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles(
                        $dataIsolation,
                        $workDir,
                        (int) $taskStatus->projectId,
                        $this->getFullFileKey($taskStatus->tempHiddenDirectory, $workDir, $projectOrganizationCode),
                        $projectOrganizationCode
                    );
                    $this->logger->info('删除隐藏目录及其子文件成功', [
                        'task_key' => $taskStatus->taskKey,
                        'hidden_directory_id' => $taskStatus->tempHiddenDirectoryId,
                        'hidden_directory_path' => $taskStatus->tempHiddenDirectory,
                        'deleted_count' => $deletedCount,
                    ]);
                } else {
                    // 降级：如果获取不到 workDir，只删除目录记录
                    $this->taskFileDomainService->deleteById((int) $taskStatus->tempHiddenDirectoryId);
                    $this->logger->warning('无法获取workDir，仅删除隐藏目录记录', [
                        'task_key' => $taskStatus->taskKey,
                        'hidden_directory_id' => $taskStatus->tempHiddenDirectoryId,
                    ]);
                }
            } catch (Throwable $e) {
                $this->logger->warning('删除隐藏目录失败', [
                    'task_key' => $taskStatus->taskKey,
                    'hidden_directory_id' => $taskStatus->tempHiddenDirectoryId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // 清理显示目录（包含目录下的所有文件，包括预设文件）
        if (! empty($taskStatus->displayDirectoryId) && ! empty($taskStatus->displayDirectory)) {
            try {
                if (! empty($workDir)) {
                    // 使用 deleteDirectoryFiles 级联删除目录及其所有子文件
                    $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles(
                        $dataIsolation,
                        $workDir,
                        (int) $taskStatus->projectId,
                        $this->getFullFileKey($taskStatus->displayDirectory, $workDir, $projectOrganizationCode),
                        $projectOrganizationCode
                    );
                    $this->logger->info('删除显示目录及其子文件成功', [
                        'task_key' => $taskStatus->taskKey,
                        'display_directory_id' => $taskStatus->displayDirectoryId,
                        'display_directory_path' => $taskStatus->displayDirectory,
                        'deleted_count' => $deletedCount,
                    ]);
                } else {
                    // 降级：如果获取不到 workDir，只删除目录记录
                    $this->taskFileDomainService->deleteById((int) $taskStatus->displayDirectoryId);
                    $this->logger->warning('无法获取workDir，仅删除显示目录记录', [
                        'task_key' => $taskStatus->taskKey,
                        'display_directory_id' => $taskStatus->displayDirectoryId,
                    ]);
                }
            } catch (Throwable $e) {
                $this->logger->warning('删除显示目录失败', [
                    'task_key' => $taskStatus->taskKey,
                    'display_directory_id' => $taskStatus->displayDirectoryId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // 清理已合并的音频文件（如果存在且不在上面的目录中）
        if (! empty($taskStatus->audioFileId)) {
            try {
                $this->taskFileDomainService->deleteById((int) $taskStatus->audioFileId);
                $this->logger->info('删除音频文件成功', [
                    'task_key' => $taskStatus->taskKey,
                    'audio_file_id' => $taskStatus->audioFileId,
                ]);
            } catch (Throwable $e) {
                $this->logger->warning('删除音频文件失败', [
                    'task_key' => $taskStatus->taskKey,
                    'audio_file_id' => $taskStatus->audioFileId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // 检查项目下是否还有其他文件，如果没有则删除项目
        if (! empty($taskStatus->projectId)) {
            try {
                $this->checkAndDeleteProjectIfEmpty($taskStatus);
            } catch (Throwable $e) {
                $this->logger->warning('检查并删除空项目失败', [
                    'task_key' => $taskStatus->taskKey,
                    'project_id' => $taskStatus->projectId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->logger->info('录音取消处理完成', [
            'task_key' => $taskStatus->taskKey,
        ]);

        return true;
    }

    /**
     * 检查项目是否为空，如果为空则删除项目.
     */
    private function checkAndDeleteProjectIfEmpty(AsrTaskStatusDTO $taskStatus): void
    {
        // 获取项目下所有用户文件（不包括隐藏文件）
        $files = $this->taskFileDomainService->findUserFilesByProjectId($taskStatus->projectId);

        if (empty($files)) {
            $this->logger->info('项目下没有文件，准备删除项目', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
            ]);

            // 删除项目
            try {
                $this->projectDomainService->deleteProject((int) $taskStatus->projectId, $taskStatus->userId);
                $this->logger->info('删除空项目成功', [
                    'task_key' => $taskStatus->taskKey,
                    'project_id' => $taskStatus->projectId,
                ]);
            } catch (Throwable $e) {
                $this->logger->error('删除空项目失败', [
                    'task_key' => $taskStatus->taskKey,
                    'project_id' => $taskStatus->projectId,
                    'error' => $e->getMessage(),
                ]);
            }
        } else {
            $this->logger->info('项目下还有文件，不删除项目', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'file_count' => count($files),
            ]);
        }
    }

    /**
     * 构建完整的 file_key.
     *
     * @param string $relativePath 相对路径
     * @param string $workDir 工作目录
     * @param string $organizationCode 组织编码
     * @return string 完整的 file_key
     */
    private function getFullFileKey(string $relativePath, string $workDir, string $organizationCode): string
    {
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        return AsrAssembler::buildFileKey($fullPrefix, $workDir, $relativePath);
    }

    /**
     * 发送自动总结聊天消息.
     */
    private function sendAutoSummaryChatMessage(AsrTaskStatusDTO $taskStatus, string $userId, string $organizationCode): void
    {
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $taskStatus->topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::TopicNotExistSimple);
        }

        $chatTopicId = $topicEntity->getChatTopicId();
        $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

        $processSummaryTaskDTO = new ProcessSummaryTaskDTO(
            $taskStatus,
            $organizationCode,
            $taskStatus->projectId,
            $userId,
            $taskStatus->topicId,
            $chatTopicId,
            $conversationId,
            $taskStatus->modelId ?? ''
        );

        $userAuthorization = $this->getUserAuthorizationFromUserId($userId);
        $this->sendSummaryChatMessage($processSummaryTaskDTO, $userAuthorization);
    }

    /**
     * Execute async finish recording in coroutine.
     */
    private function executeAsyncFinishRecording(
        AsrTaskStatusDTO $taskStatus,
        string $organizationCode,
        ?string $generatedTitle
    ): void {
        $requestId = CoContext::getRequestId();
        $language = CoContext::getLanguage();
        $taskKey = $taskStatus->taskKey;
        $userId = $taskStatus->userId;

        Coroutine::create(function () use ($taskKey, $userId, $organizationCode, $generatedTitle, $language, $requestId) {
            di(TranslatorInterface::class)->setLocale($language);
            CoContext::setLanguage($language);
            CoContext::setRequestId($requestId);

            try {
                $this->handleFinishRecording($taskKey, $userId, $organizationCode, $generatedTitle);
            } catch (Throwable $e) {
                $this->logger->error('Async finish recording failed', [
                    'task_key' => $taskKey,
                    'error' => $e->getMessage(),
                ]);

                // Mark as failed
                $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);
                $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_FAILED;
                $taskStatus->phaseError = $e->getMessage();
                $this->asrTaskDomainService->saveTaskStatus($taskStatus);
            }
        });
    }

    /**
     * Check if can manually trigger summary.
     */
    private function canManualSummarize(
        AsrTaskStatusDTO $taskStatus,
        AudioProjectEntity $audioProject
    ): bool {
        return ! $audioProject->isAutoSummary()                                    // Manual mode
            && $taskStatus->status === AsrTaskStatusEnum::AUDIO_PROCESSED          // Audio processed
            && $taskStatus->recordingStatus === AsrRecordingStatusEnum::STOPPED->value
            && ! empty($taskStatus->audioFileId);                                  // Has audio file
    }
}
