<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\Assembler\ChatMessageAssembler;
use App\Application\Speech\DTO\AsrSandboxMergeResultDTO;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Application\Speech\DTO\Response\AsrFileDataDTO;
use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Enum\AsrTopicModeEnum;
use App\Application\Speech\Event\AsrSummaryMessage;
use App\Application\Speech\Event\Publish\AsrSummaryPublisher;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\AudioProjectEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\AudioProjectDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectHiddenStatusUpdatedEvent;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus as SuperAgentTaskStatus;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\ErrorCode\AsrErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
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
    private const ASR_EXTRA_VERSION = 1;

    /**
     * 阶段进行中状态的超时时间（秒），超过后查询接口会将阶段标记为失败.
     */
    private const PHASE_STALE_TIMEOUT_SECONDS = 14400;

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
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
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
        $sandboxId = null;

        try {
            $userId = $userAuthorization->getId();
            $organizationCode = $userAuthorization->getOrganizationCode();

            // 1. 验证话题并获取对话ID
            $topicEntity = $this->validationService->validateTopicOwnership((int) $summaryRequest->topicId, $userId);
            $chatTopicId = $topicEntity->getChatTopicId();
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

            // 2. 验证任务状态（如果有file_id则跳过）
            if (! $summaryRequest->hasFileId()) {
                $taskStatus = $this->validationService->validateTaskStatus($summaryRequest->taskKey, $userId);
                $sandboxId = $taskStatus->sandboxId;
            }

            // 3. 验证项目权限
            $this->validationService->getAccessibleProjectWithEditor((int) $summaryRequest->projectId, $userId, $organizationCode);

            if ($summaryRequest->hasFileId()) {
                $this->validateSummaryFile($summaryRequest->fileId, $summaryRequest->projectId);
            }

            // 先显影项目再投递 MQ，确保音频项目列表的 is_hidden=0 查询能够立即看到项目。
            // Consumer 内仍会再次幂等显影，覆盖 MQ 延迟或重试场景。
            $this->exposeSummaryProject(
                (int) $summaryRequest->projectId,
                $userId,
                $organizationCode,
                AsrSummaryMessage::MODE_RECORDING,
                $summaryRequest->taskKey
            );

            // 4. 查询项目、工作区和话题信息
            [$projectName, $workspaceName] = $this->getProjectAndWorkspaceNames($summaryRequest->projectId);
            $topicName = $topicEntity->getTopicName();

            // MQ 执行录音总结流程：由 Consumer 负责标题准备、重试和正式总结
            $this->publishSummaryToMq($summaryRequest, $userAuthorization);

            return [
                'success' => true,
                'task_status' => null,
                'conversation_id' => $conversationId,
                'sandbox_id' => $sandboxId,
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
                'sandbox_id' => $sandboxId,
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
            $hasFileId = $summaryRequest->hasFileId();
            if ($hasFileId) {
                $taskStatus = $this->createVirtualTaskStatusFromFileId($summaryRequest, $userId, $organizationCode);
            } else {
                $taskStatus = $this->validationService->validateTaskStatus($summaryRequest->taskKey, $userId);
            }

            // 普通任务的幂等检查和录音停止必须早于标题生成，避免重复任务再次触发 LLM。
            if (! $hasFileId) {
                if ($taskStatus->isSummaryCompleted()) {
                    $this->logger->info('检测到总结已完成，跳过重复处理', [
                        'task_key' => $summaryRequest->taskKey,
                        'audio_file_id' => $taskStatus->audioFileId,
                        'status' => $taskStatus->status->value,
                        'mode' => AsrSummaryMessage::MODE_RECORDING,
                    ]);
                    return;
                }

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
            }

            // 2. 使用 Redis 中保存的 topic_id 获取话题及会话信息，先完成轻量权限校验。
            $topicEntity = $this->validationService->validateTopicOwnership((int) $taskStatus->topicId, $userId);
            $chatTopicId = $topicEntity->getChatTopicId();
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

            // 先显影项目；标题 LLM 不得阻塞项目可见性。
            $this->exposeSummaryProject(
                (int) $summaryRequest->projectId,
                $userId,
                $organizationCode,
                AsrSummaryMessage::MODE_RECORDING,
                $summaryRequest->taskKey
            );

            // 普通录音先写入 merging，file_id 场景直接写入 summarizing。
            if ($hasFileId) {
                $this->asrTaskDomainService->startVirtualTaskSummarizingPhase($taskStatus);
                $this->logger->info('ASR 导入任务已进入总结阶段', [
                    'task_key' => $summaryRequest->taskKey,
                    'mode' => AsrSummaryMessage::MODE_RECORDING,
                    'summarizing_started_at' => microtime(true),
                ]);
            } else {
                $this->asrTaskDomainService->startMergingPhase($taskStatus);
                $this->logger->info('ASR 合并阶段已启动', [
                    'task_key' => $summaryRequest->taskKey,
                    'mode' => AsrSummaryMessage::MODE_RECORDING,
                    'merging_started_at' => microtime(true),
                ]);
            }

            // 标题准备必须位于业务 SUMMARY_LOCK 内，确保同一任务并发时只生成一次。
            $generatedTitle = $this->resolveTitleForEmptyProjectAndTopicNames(
                $taskStatus,
                null,
                $summaryRequest->generatedTitle,
                $summaryRequest->fileId
            );
            $this->logger->info('ASR 总结标题准备完成', [
                'task_key' => $summaryRequest->taskKey,
                'mode' => AsrSummaryMessage::MODE_RECORDING,
                'title_generated_at' => microtime(true),
                'has_title' => $generatedTitle !== '',
            ]);
            if ($generatedTitle !== '') {
                $summaryRequest = new SummaryRequestDTO(
                    $summaryRequest->taskKey,
                    $summaryRequest->projectId,
                    $summaryRequest->topicId,
                    $summaryRequest->modelId,
                    $summaryRequest->fileId,
                    $summaryRequest->note,
                    $summaryRequest->asrStreamContent,
                    $generatedTitle
                );
                if ($summaryRequest->hasFileId()) {
                    $this->redis->setex(
                        sprintf(AsrRedisKeys::SUMMARY_TITLE, md5($userId . ':' . $summaryRequest->taskKey)),
                        AsrConfig::TASK_STATUS_TTL,
                        $generatedTitle
                    );
                } else {
                    $taskStatus->summaryGeneratedTitle = $generatedTitle;
                    $this->asrTaskDomainService->saveTaskStatus($taskStatus);
                }
                $this->ensureEmptyProjectAndTopicNames(
                    $taskStatus,
                    $userId,
                    $organizationCode,
                    null,
                    $generatedTitle,
                    $summaryRequest->fileId
                );
            }

            // 3. 普通录音执行合并；file_id 已在前面直接进入 summarizing。
            if (! $hasFileId) {
                $existingWorkspaceFilePath = $taskStatus->filePath;

                try {
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
            if (! $hasFileId) {
                $this->asrTaskDomainService->startSummarizingPhase($taskStatus);
                $this->logger->info('ASR 总结阶段已启动', [
                    'task_key' => $summaryRequest->taskKey,
                    'mode' => AsrSummaryMessage::MODE_RECORDING,
                    'summarizing_started_at' => microtime(true),
                ]);
            }

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

            // 6. 普通任务保存 Redis 状态；file_id 虚拟任务不能创建任务 Hash。
            if (! $hasFileId) {
                $this->asrTaskDomainService->saveTaskStatus($taskStatus);
            }

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
     * 异步补齐手动总结后的项目/话题标题，不重复触发正式总结。
     */
    public function handleAsyncTitleOnly(
        string $taskKey,
        string $userId,
        string $organizationCode,
        ?string $preferredTitle = null,
        ?string $audioFileId = null
    ): void {
        $lockName = sprintf(AsrRedisKeys::SUMMARY_LOCK, md5($userId . ':' . $taskKey));
        $lockOwner = sprintf('%s:%s:%s', $userId, $taskKey, microtime(true));
        if (! $this->locker->spinLock($lockName, $lockOwner, AsrConfig::SUMMARY_LOCK_TTL)) {
            return;
        }

        try {
            $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);
            if ($taskStatus->isEmpty()) {
                return;
            }

            $generatedTitle = $this->ensureEmptyProjectAndTopicNames(
                $taskStatus,
                $userId,
                $organizationCode,
                null,
                $preferredTitle,
                $audioFileId ?: $taskStatus->audioFileId
            );
            if (! empty($generatedTitle) && empty($taskStatus->summaryGeneratedTitle)) {
                $taskStatus->summaryGeneratedTitle = $generatedTitle;
                $this->asrTaskDomainService->saveTaskStatus($taskStatus);
            }
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
     * 持久化 /summary 请求中补传的标题素材，避免大文本进入 MQ。
     */
    public function persistSummaryRequestContext(SummaryRequestDTO $request, string $userId, string $language): void
    {
        if ($request->hasFileId() || $request->taskKey === '') {
            return;
        }

        $taskStatus = $this->getTaskStatusFromRedis($request->taskKey, $userId);
        if ($taskStatus->isEmpty()) {
            return;
        }

        if (! empty($request->asrStreamContent)) {
            $taskStatus->asrStreamContent = mb_substr($request->asrStreamContent, 0, 10000);
        }
        if ($request->note?->hasContent()) {
            $taskStatus->noteContent = mb_substr($request->note->content, 0, 25000);
            $taskStatus->noteFileType = $request->note->getFileExtension();
        }
        $taskStatus->language = $language;
        $this->saveTaskStatusToRedis($taskStatus);
    }

    public function loadRecoverFinishRecordingTaskStatus(
        string $taskKey,
        string $userId,
        string $organizationCode
    ): AsrTaskStatusDTO {
        $taskStatus = $this->asrTaskDomainService->getTaskStatusWithPermission($taskKey, $userId, $organizationCode);
        $this->hydrateRecoverSandboxContext($taskStatus);
        $this->saveTaskStatusToRedis($taskStatus);

        return $taskStatus;
    }

    /**
     * 保存任务状态到Redis.
     */
    public function saveTaskStatusToRedis(AsrTaskStatusDTO $taskStatus, int $ttl = AsrConfig::TASK_STATUS_TTL): void
    {
        $this->syncAsrRecoverableContextToDatabase($taskStatus);
        $this->asrTaskDomainService->saveTaskStatus($taskStatus, $ttl);
    }

    /**
     * Persist only the deterministic ASR context needed to rebuild Redis state.
     *
     * @param array<string, mixed> $patch
     */
    public function syncAsrRecoverableContextToDatabase(AsrTaskStatusDTO $taskStatus, array $patch = []): void
    {
        if (empty($taskStatus->projectId)) {
            return;
        }

        $context = $this->mergeAssocRecursive(
            $this->buildAsrRecoverableContext($taskStatus),
            $patch
        );
        $context = $this->removeEmptyAsrExtraValues($context);
        if (empty($context)) {
            return;
        }

        try {
            $this->audioProjectDomainService->mergeAudioProjectExtra((int) $taskStatus->projectId, [
                'asr' => $context,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('同步 ASR 可恢复上下文到 DB 失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'error' => $e->getMessage(),
            ]);
        }
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
        ?string $generatedTitle = null,
        int $topicId = 0
    ): array {
        $hiddenDir = $this->directoryService->createHiddenDirectory($organizationCode, $projectId, $userId, $taskKey, $topicId);
        $displayDir = $this->directoryService->createDisplayDirectory($organizationCode, $projectId, $userId, $generatedTitle, $topicId);
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
        return $this->prepareRecordingDirectories($organizationCode, $projectId, $userId, $taskKey, $generatedTitle, (int) $topicId);
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
        string $organizationCode,
        ?int $fileShardCount = null
    ): bool {
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            ExceptionBuilder::throw(AsrErrorCode::TaskNotExist);
        }

        // 保存 model_id、ASR 内容、笔记内容、标记内容和语种
        $this->updateTaskStatusFromReport($taskStatus, $modelId, $asrStreamContent, $noteContent, $noteFileType, $markerContent, $language);
        if ($status === AsrRecordingStatusEnum::STOPPED && $fileShardCount !== null) {
            $taskStatus->fileShardCount = $fileShardCount;
            // 先持久化分片数，覆盖“任务此前已 stopped、handleStopRecording 幂等返回”的场景。
            $this->saveTaskStatusToRedis($taskStatus);
        }

        // 在应用边界注册延迟授权，首次沙箱消费时才获取 token。
        $dataIsolation = $this->createContactDataIsolationByUser($organizationCode, $userId);

        // 根据状态处理
        return match ($status) {
            AsrRecordingStatusEnum::START => $this->handleStartRecording($dataIsolation, $taskStatus),
            AsrRecordingStatusEnum::RECORDING => $this->handleRecordingHeartbeat($dataIsolation, $taskStatus),
            AsrRecordingStatusEnum::PAUSED => $this->handlePauseRecording($dataIsolation, $taskStatus),
            AsrRecordingStatusEnum::STOPPED => $this->handleStopRecording($dataIsolation, $taskStatus),
            AsrRecordingStatusEnum::CANCELED => $this->handleCancelRecording($dataIsolation, $taskStatus),
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

            $this->exposeSummaryProject(
                (int) $taskStatus->projectId,
                $userId,
                $organizationCode,
                AsrSummaryMessage::MODE_RECORDING,
                $taskStatus->taskKey
            );

            // 项目显影后立即写入 merging，标题 LLM 不阻塞阶段展示。
            $this->asrTaskDomainService->startMergingPhase($taskStatus);
            $this->logger->info('ASR 自动总结合并阶段已启动', [
                'task_key' => $taskStatus->taskKey,
                'mode' => AsrSummaryMessage::MODE_RECORDING,
                'merging_started_at' => microtime(true),
            ]);

            // 生成标题；异常时使用默认标题继续合并。
            try {
                $fileTitle = $this->titleGeneratorService->generateFromTaskStatus($taskStatus);
            } catch (Throwable $e) {
                $this->logger->warning('自动总结标题生成失败，使用默认标题继续', [
                    'task_key' => $taskStatus->taskKey,
                    'error' => $e->getMessage(),
                ]);
                $fileTitle = $this->titleGeneratorService->generateDefaultDirectoryName();
            }
            $this->logger->info('ASR 自动总结标题准备完成', [
                'task_key' => $taskStatus->taskKey,
                'mode' => AsrSummaryMessage::MODE_RECORDING,
                'title_generated_at' => microtime(true),
                'has_title' => ! empty($fileTitle),
            ]);
            if (! empty($fileTitle)) {
                $taskStatus->summaryGeneratedTitle = $this->titleGeneratorService->sanitizeTitle($fileTitle);
                $this->asrTaskDomainService->saveTaskStatus($taskStatus);
            }

            $this->ensureEmptyProjectAndTopicNames(
                $taskStatus,
                $userId,
                $organizationCode,
                null,
                $fileTitle
            );

            // 先生成新的显示目录路径并更新到 taskStatus（确保沙箱使用正确的目录）
            if (! empty($fileTitle)) {
                $newDisplayDirectory = $this->directoryService->getNewDisplayDirectory(
                    $taskStatus,
                    $fileTitle,
                    $this->titleGeneratorService
                );
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }
            $this->setFinishRecoverableContext($taskStatus, $fileTitle);

            // 首次读取时才按用户查询授权，后续录音沙箱请求复用同一结果。
            $dataIsolation = $this->createContactDataIsolationByUser($organizationCode, $userId);

            // 合并音频（沙箱会重命名目录但不会通知文件变动）
            $this->asrSandboxService->mergeAudioFiles($dataIsolation, $taskStatus, $fileTitle, AsrTaskStatusEnum::COMPLETED);
            $this->syncAsrRecoverableContextToDatabase($taskStatus);

            // ===== Phase 1: 状态管理 - 完成合并 =====
            $this->asrTaskDomainService->completeMergingPhase($taskStatus);

            // ===== Phase 2: 状态管理 - 开始总结 =====
            $this->asrTaskDomainService->startSummarizingPhase($taskStatus);
            $this->logger->info('ASR 自动总结阶段已启动', [
                'task_key' => $taskStatus->taskKey,
                'mode' => AsrSummaryMessage::MODE_RECORDING,
                'summarizing_started_at' => microtime(true),
            ]);

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

        // 兜底：合并/总结阶段进行中超过 4 小时，标记为失败
        $this->failStaleInProgressPhase($taskStatus, $audioProject);

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

        // 手动总结没有 merging 阶段，但仍保证项目在进入 summarizing 前可见。
        $this->exposeSummaryProject(
            (int) $taskStatus->projectId,
            $userId,
            $organizationCode,
            AsrSummaryMessage::MODE_TITLE_ONLY,
            $taskKey
        );

        // ===== Step 4: State Management - Start summarizing phase =====
        $this->asrTaskDomainService->startSummarizingPhase($taskStatus);
        $this->logger->info('ASR 手动总结阶段已启动', [
            'task_key' => $taskKey,
            'mode' => AsrSummaryMessage::MODE_TITLE_ONLY,
            'summarizing_started_at' => microtime(true),
        ]);

        // Async trigger summary
        $this->sendAutoSummaryChatMessage($taskStatus, $userId, $organizationCode);

        // Mark as completed
        $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        // 正式总结保持同步；标题补齐作为 best-effort 异步任务投递。
        try {
            $this->publishTitleOnlyToMq($taskStatus, $userAuthorization);
        } catch (Throwable $e) {
            $this->logger->warning('手动总结标题异步任务投递失败，不影响正式总结', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'success' => true,
            'task_key' => $taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'summary' => [
                'status' => 'in_progress',
                'topic_id' => $taskStatus->topicId,
                'model_id' => $taskStatus->modelId,
            ],
            'message' => 'Summary is being generated, you will receive updates via WebSocket',
        ];
    }

    /**
     * Manually trigger re-summary for an existing audio project.
     */
    public function triggerResummary(
        string $taskKey,
        ?string $modelId,
        MagicUserAuthorization $userAuthorization
    ): array {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        $taskStatus = $this->asrTaskDomainService->getTaskStatus($taskKey, $userId);

        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId(
            (int) $taskStatus->projectId
        );

        if ($audioProject === null) {
            ExceptionBuilder::throw(AsrErrorCode::ProjectNotExist);
        }

        if (! $this->canManualResummarize($taskStatus)) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        $effectiveTopicId = $taskStatus->topicId;
        if (empty($effectiveTopicId)) {
            $effectiveTopicId = (string) $audioProject->getTopicId();
        }
        if (empty($effectiveTopicId)) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterMissing,
                'topic_id is required for re-summary'
            );
        }

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

        $this->audioProjectDomainService->updateTopicAndModel(
            (int) $taskStatus->projectId,
            (int) $effectiveTopicId,
            $effectiveModelId
        );

        $taskStatus->topicId = $effectiveTopicId;
        $taskStatus->modelId = $effectiveModelId;
        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        $this->asrTaskDomainService->startSummarizingPhase($taskStatus);

        $this->sendAutoResummaryChatMessage(
            $taskStatus,
            $userId,
            $organizationCode,
        );

        $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'summary' => [
                'status' => 'in_progress',
                'topic_id' => $taskStatus->topicId,
                'model_id' => $taskStatus->modelId,
            ],
            'message' => 'Re-summary is being generated, you will receive updates via WebSocket',
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
                if ($taskStatus->phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_COMPLETED
                    && ! empty($taskStatus->audioFileId)) {
                    $this->completeRecoverFromExistingAudioFileIfPossible($taskStatus);
                }

                return [
                    'success' => true,
                    'task_key' => $taskKey,
                    'sandbox_id' => $taskStatus->sandboxId,
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

        // 在启动后台合并前同步显影，避免 finish-recording 返回后列表仍过滤掉项目。
        $this->exposeSummaryProject(
            (int) $taskStatus->projectId,
            $userId,
            $organizationCode,
            AsrSummaryMessage::MODE_RECORDING,
            $taskKey
        );

        $this->asrTaskDomainService->saveTaskStatus($taskStatus);

        // Execute async. handleFinishRecording re-resolves the per-user
        // authorization token internally (it has $userId), so we don't
        // need to thread it through here.
        $this->executeAsyncFinishRecording($taskStatus, $organizationCode, $generatedTitle);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'phase' => AsrTaskStatusDTO::PHASE_MERGING,
            'status' => AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS,
            'percent' => 0,
            'message' => 'Finish recording started, query progress via GET /asr/tasks/{task_key}/progress',
        ];
    }

    /**
     * Async trigger finish-recording recovery (immediately return, execute in background).
     */
    public function triggerRecoverFinishRecordingAsync(
        AsrTaskStatusDTO $taskStatus,
        string $organizationCode,
        ?string $generatedTitle = null
    ): array {
        $taskKey = $taskStatus->taskKey;

        if ($taskStatus->isEmpty()) {
            ExceptionBuilder::throw(AsrErrorCode::TaskNotExist);
        }

        if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::CANCELED->value) {
            ExceptionBuilder::throw(AsrErrorCode::TaskAlreadyCanceled);
        }

        if (! empty($taskStatus->audioFileId)) {
            $this->completeRecoverFromExistingAudioFileIfPossible($taskStatus);

            return $this->buildRecoverAlreadyCompletedResponse($taskStatus);
        }

        if ($taskStatus->recordingStatus !== AsrRecordingStatusEnum::STOPPED->value) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        if ($taskStatus->currentPhase !== AsrTaskStatusDTO::PHASE_MERGING) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        $recoverablePhaseStatuses = [
            AsrTaskStatusDTO::PHASE_STATUS_FAILED,
            AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS,
            AsrTaskStatusDTO::PHASE_STATUS_COMPLETED,
        ];
        if (! in_array($taskStatus->phaseStatus, $recoverablePhaseStatuses, true)) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        if ($taskStatus->phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS) {
            $lockName = sprintf(AsrRedisKeys::FINISH_RECORDING_LOCK, $taskKey);
            if ($this->redis->exists($lockName)) {
                $taskStatus->updateStatus(AsrTaskStatusEnum::PROCESSING);
                $this->asrTaskDomainService->saveTaskStatusWithDatabaseSync($taskStatus);

                return [
                    'success' => true,
                    'task_key' => $taskKey,
                    'sandbox_id' => $taskStatus->sandboxId,
                    'phase' => $taskStatus->currentPhase,
                    'status' => $taskStatus->phaseStatus,
                    'percent' => $taskStatus->phasePercent,
                    'action' => 'finish_recording_already_running',
                    'message' => 'Finish recording is already running',
                ];
            }
        }

        if ($this->completeRecoverFromExistingAudioFileIfPossible($taskStatus)) {
            return $this->buildRecoverAlreadyCompletedResponse($taskStatus);
        }

        if (empty($taskStatus->sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        if (! $taskStatus->sandboxTaskCreated) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidTaskStatus);
        }

        $taskStatus->updateStatus(AsrTaskStatusEnum::PROCESSING);

        // 在启动后台恢复前同步显影，保持 recover 与 finish-recording 一致。
        $this->exposeSummaryProject(
            (int) $taskStatus->projectId,
            $taskStatus->userId,
            $organizationCode,
            AsrSummaryMessage::MODE_RECORDING,
            $taskKey
        );
        $this->asrTaskDomainService->startMergingPhase($taskStatus);

        $this->executeAsyncRecoverFinishRecording($taskStatus, $organizationCode, $generatedTitle);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'phase' => AsrTaskStatusDTO::PHASE_MERGING,
            'status' => AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS,
            'percent' => 0,
            'action' => 'finish_recording_recovery_started',
            'message' => 'Finish recording recovery has started',
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
        // 首次读取时才按用户查询授权 token。
        $dataIsolation = $this->createContactDataIsolationByUser($organizationCode, $userId);

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

            // Execute merge
            $fileTitle = $this->resolveFinishRecordingFileTitle($taskStatus, $generatedTitle);
            $this->renameProjectAfterFinishRecording($taskStatus, $fileTitle, $userId);
            if ($fileTitle !== $this->translator->trans('asr.file_names.original_recording')) {
                $newDisplayDirectory = $this->directoryService->getNewDisplayDirectory(
                    $taskStatus,
                    $fileTitle,
                    $this->titleGeneratorService
                );
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }
            $this->setFinishRecoverableContext($taskStatus, $fileTitle);

            // Update progress: 50%
            $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 50);

            $mergeResult = $this->asrSandboxService->mergeAudioFiles(
                $dataIsolation,
                $taskStatus,
                $fileTitle,
                AsrTaskStatusEnum::AUDIO_PROCESSED
            );
            $this->syncAsrRecoverableContextToDatabase($taskStatus);

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
     * Handle finish-recording recovery logic (can be called by API or cron).
     */
    public function handleRecoverFinishRecording(
        string $taskKey,
        string $userId,
        string $organizationCode,
        ?string $generatedTitle = null
    ): void {
        $lockName = sprintf(AsrRedisKeys::FINISH_RECORDING_LOCK, $taskKey);
        $lockOwner = sprintf('%s:%s:%s', $userId, $taskKey, microtime(true));
        $locked = $this->locker->spinLock($lockName, $lockOwner, AsrConfig::FINISH_RECORDING_LOCK_TTL);

        if (! $locked) {
            $this->logger->warning('Failed to acquire finish recording recovery lock', [
                'task_key' => $taskKey,
            ]);
            return;
        }

        try {
            // 首次读取时才按用户查询授权 token。
            $dataIsolation = $this->createContactDataIsolationByUser($organizationCode, $userId);

            $taskStatus = $this->loadRecoverFinishRecordingTaskStatus($taskKey, $userId, $organizationCode);

            if ($taskStatus->phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_COMPLETED
                && $taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_MERGING
                && ! empty($taskStatus->audioFileId)) {
                $this->completeRecoverFromExistingAudioFileIfPossible($taskStatus);

                $this->logger->info('Finish recording recovery already completed', [
                    'task_key' => $taskKey,
                ]);
                return;
            }

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

            $this->asrTaskDomainService->startMergingPhase($taskStatus);
            $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 10);

            $fileTitle = $this->resolveFinishRecordingFileTitle($taskStatus, $generatedTitle);
            $this->renameProjectAfterFinishRecording($taskStatus, $fileTitle, $userId);
            if ($fileTitle !== $this->translator->trans('asr.file_names.original_recording')) {
                $newDisplayDirectory = $this->directoryService->getNewDisplayDirectory(
                    $taskStatus,
                    $fileTitle,
                    $this->titleGeneratorService
                );
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }
            $this->setFinishRecoverableContext($taskStatus, $fileTitle);

            if ($taskStatus->sandboxMergeCompleted) {
                $mergeResult = $this->buildMergeResultFromCheckpoint($taskStatus);
                $this->completeRecoverFromSandboxMergeResult($taskStatus, $mergeResult);
                return;
            }

            if ($this->completeRecoverFromExistingAudioFileIfPossible($taskStatus)) {
                return;
            }

            $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 50);

            $mergeResult = $this->asrSandboxService->recoverFinishRecording(
                $dataIsolation,
                $taskStatus,
                $fileTitle,
                AsrTaskStatusEnum::AUDIO_PROCESSED
            );
            $this->persistSandboxMergeCheckpoint($taskStatus, $mergeResult);
            $this->completeRecoverFromSandboxMergeResult($taskStatus, $mergeResult);

            $this->logger->info('Finish recording recovery completed', [
                'task_key' => $taskKey,
                'audio_file_id' => $taskStatus->audioFileId,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Finish recording recovery failed', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * Recover a stuck merging task by reading the sandbox result file ({task_key}.json).
     *
     * This is the idempotent recovery path used by AsrMergingRecoveryMonitor when
     * magic-service was restarted while the sandbox was still merging audio files.
     *
     * The sandbox writes its final result to `{task_key}.json` in the project workspace.
     * We read that file and branch on task.status:
     *   - "completed" → run the post-merge completion steps (80 % progress, metadata, phase done)
     *   - "running"   → sandbox still working, nothing to do
     *   - other       → treat as failed, re-throw so the caller can apply the retry counter
     *
     * @return bool true = recovery completed, false = sandbox still running (skip silently)
     * @throws RuntimeException when the result file is missing or sandbox reported an error
     */
    public function recoverCompletedMerging(
        int $projectId,
        string $taskKey,
        string $userId,
        string $organizationCode
    ): bool {
        // ── 1. Load task status ───────────────────────────────────────────────
        $taskStatus = $this->asrTaskDomainService->findTaskByKey($taskKey, $userId);
        if ($taskStatus === null) {
            $taskStatus = $this->asrTaskDomainService->rebuildFromDatabase($taskKey, $userId);
        }
        if ($taskStatus === null) {
            throw new RuntimeException(
                sprintf('Task status not found for task_key=%s user_id=%s', $taskKey, $userId)
            );
        }

        // ── 2. Idempotent guard ───────────────────────────────────────────────
        if ($taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_MERGING
            && $taskStatus->phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_COMPLETED
            && ! empty($taskStatus->audioFileId)) {
            $this->completeRecoverFromExistingAudioFileIfPossible($taskStatus);

            $this->logger->info('recoverCompletedMerging: already completed, skipping', [
                'task_key' => $taskKey,
            ]);
            return true;
        }

        // ── 3. Read sandbox result file ({task_key}.json) ─────────────────────
        $resultFileName = $taskKey . '.json';
        $fileEntity = $this->taskFileDomainService->getByProjectIdAndFileName($projectId, $resultFileName);
        if ($fileEntity === null) {
            throw new RuntimeException(
                sprintf('Sandbox result file not found: project_id=%d file=%s', $projectId, $resultFileName)
            );
        }

        $fileUrl = $this->getSandboxFileDownloadUrl($fileEntity);
        if (empty($fileUrl)) {
            throw new RuntimeException(
                sprintf('Could not get download URL for sandbox result file: file_id=%d', $fileEntity->getFileId())
            );
        }

        $rawContent = @file_get_contents($fileUrl);
        if ($rawContent === false || empty(trim($rawContent))) {
            throw new RuntimeException(
                sprintf('Failed to download sandbox result file: file_id=%d', $fileEntity->getFileId())
            );
        }

        $data = json_decode($rawContent, true);
        if (! is_array($data)) {
            throw new RuntimeException(
                sprintf('Invalid JSON in sandbox result file: file_id=%d', $fileEntity->getFileId())
            );
        }

        // ── 4. Branch on sandbox status ───────────────────────────────────────
        $sandboxStatus = $data['task']['status'] ?? 'unknown';

        $this->logger->info('recoverCompletedMerging: sandbox result read', [
            'task_key' => $taskKey,
            'sandbox_status' => $sandboxStatus,
        ]);

        if ($sandboxStatus === 'running') {
            // Sandbox is still in progress; the pod restart caused us to lose the
            // polling coroutine but the sandbox will keep running. Nothing to do.
            return false;
        }

        if ($sandboxStatus !== 'completed') {
            $this->logger->warning('recoverCompletedMerging: sandbox not completed, falling back to handleFinishRecording', [
                'task_key' => $taskKey,
                'sandbox_status' => $sandboxStatus,
            ]);
            $this->handleFinishRecording($taskKey, $userId, $organizationCode, null);
            return true;
        }

        // ── 5. Complete the post-merge steps ──────────────────────────────────
        $duration = isset($data['task']['duration']) ? (int) $data['task']['duration'] : null;
        $fileSize = isset($data['task']['file_size']) ? (int) $data['task']['file_size'] : null;
        $audioFileId = ! empty($taskStatus->audioFileId) ? (int) $taskStatus->audioFileId : null;

        // 80 % progress (sandbox merge done, finalising metadata)
        $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 80);

        // Update recording metadata from sandbox result
        $this->audioProjectDomainService->updateRecordingMetadata(
            $projectId,
            $duration,
            $fileSize,
            'recorded',
            $audioFileId
        );

        // Mark merging phase as fully completed
        $this->asrTaskDomainService->completeMergingPhase($taskStatus);

        $this->logger->info('recoverCompletedMerging: merging phase completed successfully', [
            'task_key' => $taskKey,
            'duration' => $duration,
            'file_size' => $fileSize,
            'audio_file_id' => $audioFileId,
        ]);

        return true;
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
            // 兜底：合并/总结阶段进行中超过 4 小时，标记为失败
            $this->failStaleInProgressPhase($taskStatus, $audioProject);

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

    private function validateSummaryFile(?string $fileId, string $projectId): void
    {
        $fileEntity = $this->taskFileDomainService->getById((int) $fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::FileNotExist, '', ['fileId' => $fileId]);
        }

        if ((string) $fileEntity->getProjectId() !== $projectId) {
            ExceptionBuilder::throw(AsrErrorCode::FileNotBelongToProject, '', ['fileId' => $fileId]);
        }
    }

    /**
     * 兜底：合并/总结阶段长时间停留在进行中时，将阶段标记为失败（Redis + DB 双写）.
     *
     * 时间基准使用 audio project 行的 updated_at：阶段卡死时该行不会再被写入，
     * 因此 updated_at 近似等于阶段开始时间。任何失败只记录日志，不影响查询响应。
     */
    private function failStaleInProgressPhase(AsrTaskStatusDTO $taskStatus, AudioProjectEntity $audioProject): void
    {
        try {
            if ($taskStatus->phaseStatus !== AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS) {
                return;
            }

            if (! in_array($taskStatus->currentPhase, [
                AsrTaskStatusDTO::PHASE_MERGING,
                AsrTaskStatusDTO::PHASE_SUMMARIZING,
            ], true)) {
                return;
            }

            $updatedAt = $audioProject->getUpdatedAt();
            if (empty($updatedAt)) {
                return;
            }

            $updatedTimestamp = strtotime($updatedAt);
            if ($updatedTimestamp === false || time() - $updatedTimestamp <= self::PHASE_STALE_TIMEOUT_SECONDS) {
                return;
            }

            $errorMessage = 'Processing timeout: phase in_progress exceeded 4 hours';
            $this->logger->warning('检测到阶段处理超时，标记为失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'current_phase' => $taskStatus->currentPhase,
                'updated_at' => $updatedAt,
            ]);

            if ($taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_MERGING) {
                $this->asrTaskDomainService->failMergingPhase($taskStatus, $errorMessage);
            } else {
                $this->asrTaskDomainService->failSummarizingPhase($taskStatus, $errorMessage);
            }
        } catch (Throwable $e) {
            $this->logger->error('阶段超时兜底处理失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'current_phase' => $taskStatus->currentPhase,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function persistSandboxMergeCheckpoint(
        AsrTaskStatusDTO $taskStatus,
        AsrSandboxMergeResultDTO $mergeResult
    ): void {
        $audioPath = $mergeResult->responseData['files']['audio_file']['path'] ?? $mergeResult->filePath;
        $taskStatus->filePath = is_string($audioPath) && $audioPath !== '' ? $audioPath : $taskStatus->filePath;
        $taskStatus->sandboxMergeCompleted = true;
        $taskStatus->sandboxMergeDuration = $mergeResult->duration;
        $taskStatus->sandboxMergeFileSize = $mergeResult->fileSize;
        $taskStatus->sandboxFinishResponseJson = json_encode(
            $mergeResult->responseData,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        $this->saveTaskStatusToRedis($taskStatus);
    }

    private function buildMergeResultFromCheckpoint(AsrTaskStatusDTO $taskStatus): AsrSandboxMergeResultDTO
    {
        $responseData = [];
        if (! empty($taskStatus->sandboxFinishResponseJson)) {
            $decoded = json_decode($taskStatus->sandboxFinishResponseJson, true, 512, JSON_THROW_ON_ERROR);
            $responseData = is_array($decoded) ? $decoded : [];
        }

        if ($responseData === [] && ! empty($taskStatus->filePath)) {
            $responseData = [
                'status' => 'completed',
                'files' => [
                    'audio_file' => ['path' => $taskStatus->filePath],
                ],
            ];
        }

        return AsrSandboxMergeResultDTO::fromSandboxResponse([
            'status' => 'completed',
            'file_path' => $taskStatus->filePath,
            'duration' => $taskStatus->sandboxMergeDuration,
            'file_size' => $taskStatus->sandboxMergeFileSize,
            'response_data' => $responseData,
        ]);
    }

    private function completeRecoverFromSandboxMergeResult(
        AsrTaskStatusDTO $taskStatus,
        AsrSandboxMergeResultDTO $mergeResult
    ): void {
        $this->asrSandboxService->handleMergeResultFiles($taskStatus, $mergeResult);
        $this->saveTaskStatusToRedis($taskStatus);
        $this->asrTaskDomainService->updatePhaseProgress($taskStatus, 80);

        $audioFileId = ! empty($taskStatus->audioFileId) ? (int) $taskStatus->audioFileId : null;
        $this->audioProjectDomainService->updateRecordingMetadata(
            (int) $taskStatus->projectId,
            $mergeResult->duration,
            $mergeResult->fileSize,
            'recorded',
            $audioFileId
        );

        $this->asrTaskDomainService->completeMergingPhase($taskStatus);
    }

    private function hydrateRecoverSandboxContext(AsrTaskStatusDTO $taskStatus): void
    {
        if (empty($taskStatus->projectId) || empty($taskStatus->userId)) {
            return;
        }

        if (! empty($taskStatus->sandboxId)) {
            $taskStatus->sandboxTaskCreated = true;
            return;
        }

        $hiddenTopic = $this->superAgentTopicDomainService->findHiddenTopicByProjectUserAndMode(
            (int) $taskStatus->projectId,
            $taskStatus->userId,
            AsrTopicModeEnum::AUDIO_MERGE->value
        );

        if ($hiddenTopic !== null) {
            $taskStatus->sandboxTopicId = $hiddenTopic->getId();
            $sandboxId = $hiddenTopic->getSandboxId();
            if ($sandboxId !== '') {
                $taskStatus->sandboxId = $sandboxId;
            }
        }

        $taskStatus->sandboxTaskCreated = ! empty($taskStatus->sandboxId);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildAsrRecoverableContext(AsrTaskStatusDTO $taskStatus): array
    {
        $context = [
            'version' => self::ASR_EXTRA_VERSION,
            'sandbox' => [
                'sandbox_topic_id' => $taskStatus->sandboxTopicId,
                'sandbox_id' => $taskStatus->sandboxId,
                'sandbox_task_created' => $taskStatus->sandboxTaskCreated,
                'merge_completed' => $taskStatus->sandboxMergeCompleted,
                'merge_duration' => $taskStatus->sandboxMergeDuration,
                'merge_file_size' => $taskStatus->sandboxMergeFileSize,
                'finish_response_json' => $taskStatus->sandboxFinishResponseJson,
                'workspace_dir' => '.workspace',
            ],
            'directories' => [
                'temp_hidden_directory' => $taskStatus->tempHiddenDirectory,
                'temp_hidden_directory_id' => $taskStatus->tempHiddenDirectoryId,
                'display_directory' => $taskStatus->displayDirectory,
                'display_directory_id' => $taskStatus->displayDirectoryId,
            ],
            'finish' => [
                'source_dir' => $taskStatus->tempHiddenDirectory,
                'target_dir' => $taskStatus->displayDirectory,
                'output_filename' => $taskStatus->finishOutputFilename,
                'expected_audio_file_name' => $taskStatus->expectedAudioFileName,
                'file_shard_count' => $taskStatus->fileShardCount,
            ],
            'preset_files' => [
                'note_file_id' => $taskStatus->presetNoteFileId,
                'note_file_path' => $this->normalizeWorkspaceRelativePath($taskStatus->presetNoteFilePath),
                'transcript_file_id' => $taskStatus->presetTranscriptFileId,
                'transcript_file_path' => $this->normalizeWorkspaceRelativePath($taskStatus->presetTranscriptFilePath),
                'marker_file_id' => $taskStatus->presetMarkerFileId,
                'marker_file_path' => $this->normalizeWorkspaceRelativePath($taskStatus->presetMarkerFilePath),
            ],
            'result_files' => [
                'audio_file_path' => $this->normalizeWorkspaceRelativePath($taskStatus->filePath),
                'note_file_id' => $taskStatus->noteFileId,
                'note_file_name' => $taskStatus->noteFileName,
                'marker_file_id' => $taskStatus->markerFileId,
                'marker_file_name' => $taskStatus->markerFileName,
            ],
        ];

        return $this->removeEmptyAsrExtraValues($context);
    }

    private function normalizeWorkspaceRelativePath(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return $path;
        }

        return AsrAssembler::extractWorkspaceRelativePath($path);
    }

    private function setFinishRecoverableContext(AsrTaskStatusDTO $taskStatus, string $fileTitle): void
    {
        $taskStatus->finishOutputFilename = $fileTitle;
        if (! empty($taskStatus->audioFormat)) {
            $taskStatus->expectedAudioFileName = $fileTitle . '.' . $taskStatus->audioFormat;
        }
        $this->syncAsrRecoverableContextToDatabase($taskStatus);
    }

    /**
     * 构建期望音频文件名的候选列表.
     *
     * 产物扩展名跟随任务分片格式（opus 任务产出 .opus，wav 任务产出 .wav），
     * 状态未确定格式时可能没有扩展名，恢复查找时兼容 wav 和 opus 两种后缀。
     *
     * @return array<int, string>
     */
    private function buildExpectedAudioFileNameCandidates(string $expectedAudioFileName): array
    {
        $baseName = (string) preg_replace('/\.(wav|opus)$/i', '', $expectedAudioFileName);

        return array_values(array_unique([$expectedAudioFileName, $baseName . '.wav', $baseName . '.opus']));
    }

    private function completeRecoverFromExistingAudioFileIfPossible(AsrTaskStatusDTO $taskStatus): bool
    {
        if (! empty($taskStatus->audioFileId)) {
            $taskStatus->updateStatus(AsrTaskStatusEnum::AUDIO_PROCESSED);
            $this->audioProjectDomainService->updateRecordingMetadata(
                (int) $taskStatus->projectId,
                null,
                null,
                'recorded',
                (int) $taskStatus->audioFileId
            );
            $this->asrTaskDomainService->completeMergingPhase($taskStatus);

            return true;
        }

        if (empty($taskStatus->projectId)) {
            $this->logger->info('恢复 finish-recording 时跳过本地音频文件预检查，缺少精确定位字段', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'display_directory_id' => $taskStatus->displayDirectoryId,
                'expected_audio_file_name' => $taskStatus->expectedAudioFileName,
                'file_path' => $taskStatus->filePath,
            ]);
            return false;
        }

        $audioFile = null;
        $lookupStrategy = null;
        if (! empty($taskStatus->displayDirectoryId) && ! empty($taskStatus->expectedAudioFileName)) {
            $lookupStrategy = 'parent_id_and_name';
            // 音频产物扩展名跟随任务分片格式（wav/opus），按候选名查找并拒绝双文件歧义
            $matches = [];
            foreach ($this->buildExpectedAudioFileNameCandidates($taskStatus->expectedAudioFileName) as $candidateName) {
                $candidate = $this->taskFileDomainService->getByProjectParentAndName(
                    (int) $taskStatus->projectId,
                    (int) $taskStatus->displayDirectoryId,
                    $candidateName
                );
                if ($candidate !== null) {
                    $matches[] = $candidate;
                }
            }
            if (count($matches) > 1) {
                $this->logger->warning('恢复 finish-recording 时发现多个候选音频文件，停止自动恢复', [
                    'task_key' => $taskStatus->taskKey,
                    'project_id' => $taskStatus->projectId,
                    'display_directory_id' => $taskStatus->displayDirectoryId,
                    'candidates' => array_map(static fn ($file) => $file->getFileName(), $matches),
                ]);
                return false;
            }
            $audioFile = $matches[0] ?? null;
        } elseif (! empty($taskStatus->filePath)) {
            $lookupStrategy = 'historical_relative_path';
            $relativePath = $this->normalizeWorkspaceRelativePath($taskStatus->filePath);
            if (! empty($relativePath)) {
                $audioFile = $this->taskFileDomainService->findEntityByRelativePath(
                    (int) $taskStatus->projectId,
                    $relativePath
                );
                if ($audioFile?->getIsDirectory()) {
                    $audioFile = null;
                }
            }
        }

        if ($audioFile === null) {
            $this->logger->info('恢复 finish-recording 时本地文件表未找到目标音频，继续查询沙箱状态', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'display_directory_id' => $taskStatus->displayDirectoryId,
                'expected_audio_file_name' => $taskStatus->expectedAudioFileName,
                'file_path' => $taskStatus->filePath,
                'lookup_strategy' => $lookupStrategy,
            ]);
            return false;
        }

        $resolvedPath = $this->buildRelativeFilePathForEntity($audioFile, (int) $taskStatus->projectId);
        $taskStatus->audioFileId = (string) $audioFile->getFileId();
        $taskStatus->filePath = $resolvedPath;
        $taskStatus->displayDirectory = dirname($resolvedPath);
        $taskStatus->updateStatus(AsrTaskStatusEnum::AUDIO_PROCESSED);

        $this->audioProjectDomainService->updateRecordingMetadata(
            (int) $taskStatus->projectId,
            null,
            null,
            'recorded',
            (int) $taskStatus->audioFileId
        );
        $this->syncAsrRecoverableContextToDatabase($taskStatus);
        $this->asrTaskDomainService->completeMergingPhase($taskStatus);

        $this->logger->info('恢复 finish-recording 时从本地文件表补齐音频文件并完成合并阶段', [
            'task_key' => $taskStatus->taskKey,
            'audio_file_id' => $taskStatus->audioFileId,
            'audio_file_path' => $taskStatus->filePath,
        ]);

        return true;
    }

    private function buildRelativeFilePathForEntity(TaskFileEntity $entity, int $projectId): string
    {
        $filesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds(
            [$entity->getFileId()],
            $projectId
        );
        $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);
        $fileMap[$entity->getFileId()] = $entity;

        return ltrim(RelativeFilePathUtil::buildPathByParentChain($entity, $fileMap), '/');
    }

    /**
     * @return array<string, mixed>
     */
    private function buildRecoverAlreadyCompletedResponse(AsrTaskStatusDTO $taskStatus): array
    {
        return [
            'success' => true,
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'phase' => $taskStatus->currentPhase,
            'status' => $taskStatus->phaseStatus,
            'percent' => $taskStatus->phasePercent,
            'action' => 'already_completed',
            'message' => 'Finish recording is already completed',
        ];
    }

    /**
     * @param array<string, mixed> $base
     * @param array<string, mixed> $patch
     * @return array<string, mixed>
     */
    private function mergeAssocRecursive(array $base, array $patch): array
    {
        foreach ($patch as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
                $base[$key] = $this->mergeAssocRecursive($base[$key], $value);
                continue;
            }

            $base[$key] = $value;
        }

        return $base;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function removeEmptyAsrExtraValues(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $value = $this->removeEmptyAsrExtraValues($value);
                if ($value === []) {
                    unset($data[$key]);
                    continue;
                }
                $data[$key] = $value;
                continue;
            }

            if ($value === null || $value === '') {
                unset($data[$key]);
            }
        }

        return $data;
    }

    private function failRecoverMergingPhaseIfPossible(
        string $taskKey,
        string $userId,
        string $organizationCode,
        string $error
    ): void {
        try {
            $taskStatus = $this->asrTaskDomainService->getTaskStatusWithPermission($taskKey, $userId, $organizationCode);
            $this->hydrateRecoverSandboxContext($taskStatus);
            if ($taskStatus->isEmpty()) {
                return;
            }
            $this->asrTaskDomainService->failMergingPhase($taskStatus, $error);
        } catch (Throwable $statusError) {
            $this->logger->warning('Failed to mark finish recording recovery as failed', [
                'task_key' => $taskKey,
                'error' => $error,
                'status_error' => $statusError->getMessage(),
            ]);
        }
    }

    /**
     * Get presigned download URL for a sandbox-bucket file entity.
     */
    private function getSandboxFileDownloadUrl(TaskFileEntity $fileEntity): ?string
    {
        $organizationCode = $fileEntity->getOrganizationCode();
        $filePath = $fileEntity->getFileKey();
        $fileLink = $this->cloudFileRepository->getLinks(
            $organizationCode,
            [$filePath],
            StorageBucketType::SandBox
        )[$filePath] ?? null;
        return $fileLink?->getUrl();
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

        // 标题生成下沉到 Consumer；这里只复用已有标题，避免丢弃 upload-tokens 预生成结果
        $summaryRequest = new SummaryRequestDTO(
            taskKey: $taskKey,
            projectId: (string) $taskStatus->projectId,
            topicId: (string) $topicId,
            modelId: $effectiveModelId,
            fileId: (string) $fileId,
            generatedTitle: $taskStatus->summaryGeneratedTitle
                ?: $taskStatus->uploadGeneratedTitle
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
            'mode' => AsrSummaryMessage::MODE_RECORDING,
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

    private function publishTitleOnlyToMq(AsrTaskStatusDTO $taskStatus, MagicUserAuthorization $userAuthorization): void
    {
        $message = new AsrSummaryMessage(
            $taskStatus->taskKey,
            (string) $taskStatus->projectId,
            (string) $taskStatus->topicId,
            (string) $taskStatus->modelId,
            $taskStatus->audioFileId,
            null,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode(),
            CoContext::getLanguage(),
            CoContext::getRequestId(),
            0,
            AsrSummaryMessage::MODE_TITLE_ONLY
        );
        if (! $this->producer->produce(new AsrSummaryPublisher($message))) {
            throw new RuntimeException('publish title-only summary message failed');
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
     * 在总结流程进入耗时阶段前显影项目。显影失败不应阻断后续总结。
     */
    private function exposeSummaryProject(
        int $projectId,
        string $userId,
        string $organizationCode,
        string $mode,
        string $taskKey
    ): void {
        $requestedAt = microtime(true);
        try {
            $projectShown = $this->audioProjectDomainService->showProjectIfExists($projectId);
            if ($projectShown) {
                $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
                if ($projectEntity !== null) {
                    $this->eventDispatcher->dispatch(new ProjectHiddenStatusUpdatedEvent(
                        $projectEntity->getId(),
                        $userId,
                        $organizationCode,
                        $projectEntity->getProjectMode(),
                        false
                    ));
                }
            }

            $this->logger->info('ASR 总结项目显影完成', [
                'task_key' => $taskKey,
                'project_id' => $projectId,
                'mode' => $mode,
                'project_visible_at' => microtime(true),
                'project_visibility_requested_at' => $requestedAt,
                'project_was_hidden' => $projectShown,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('ASR 总结项目显影失败，继续后续流程', [
                'task_key' => $taskKey,
                'project_id' => $projectId,
                'mode' => $mode,
                'project_visibility_requested_at' => $requestedAt,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 空项目名/话题名兜底补标题。best-effort，不阻断总结主流程.
     */
    private function ensureEmptyProjectAndTopicNames(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode,
        ?MagicUserAuthorization $userAuthorization = null,
        ?string $preferredTitle = null,
        ?string $audioFileId = null
    ): ?string {
        try {
            if (empty($taskStatus->projectId) || empty($taskStatus->topicId)) {
                return null;
            }

            $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $taskStatus->projectId);
            $projectName = $projectEntity?->getProjectName();
            $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $taskStatus->topicId);
            $topicName = $topicEntity?->getTopicName();

            if (! $this->shouldUpdateNames($projectName, $topicName)) {
                return null;
            }

            $generatedTitle = $this->resolveTitleForEmptyProjectAndTopicNames(
                $taskStatus,
                $userAuthorization,
                $preferredTitle,
                $audioFileId
            );

            $this->updateEmptyProjectAndTopicNames(
                (string) $taskStatus->projectId,
                (int) $taskStatus->topicId,
                $generatedTitle,
                $userId,
                $organizationCode
            );

            return $generatedTitle;
        } catch (Throwable $e) {
            $this->logger->warning('空项目/话题名称自动补标题失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'topic_id' => $taskStatus->topicId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function resolveTitleForEmptyProjectAndTopicNames(
        AsrTaskStatusDTO $taskStatus,
        ?MagicUserAuthorization $userAuthorization,
        ?string $preferredTitle,
        ?string $audioFileId
    ): string {
        $summaryGeneratedTitle = $this->titleGeneratorService->sanitizeTitle($taskStatus->summaryGeneratedTitle ?? '');
        if ($summaryGeneratedTitle !== '') {
            return $summaryGeneratedTitle;
        }

        $uploadGeneratedTitle = $this->titleGeneratorService->sanitizeTitle($taskStatus->uploadGeneratedTitle ?? '');
        if ($uploadGeneratedTitle !== '') {
            return $uploadGeneratedTitle;
        }

        $preferredTitle = $this->titleGeneratorService->sanitizeTitle($preferredTitle ?? '');
        if ($preferredTitle !== '') {
            return $preferredTitle;
        }

        if ($taskStatus->taskKey !== '') {
            $cachedTitle = $this->titleGeneratorService->sanitizeTitle((string) $this->redis->get(
                sprintf(AsrRedisKeys::SUMMARY_TITLE, md5($taskStatus->userId . ':' . $taskStatus->taskKey))
            ));
            if ($cachedTitle !== '') {
                return $cachedTitle;
            }
        }

        try {
            $generatedFromTask = $this->titleGeneratorService->sanitizeTitle(
                $this->titleGeneratorService->generateNullableFromTaskStatus($taskStatus) ?? ''
            );
            if ($generatedFromTask !== '') {
                return $generatedFromTask;
            }
        } catch (Throwable $e) {
            // 标题 LLM 失败不应阻断正式总结，继续使用文件名或默认标题兜底。
            $this->logger->warning('根据 ASR 内容生成标题失败，继续使用兜底标题', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
            ]);
        }

        $audioFileTitle = $this->generateTitleFromAudioFileName(
            $taskStatus,
            $audioFileId ?: $taskStatus->audioFileId,
            $userAuthorization
        );
        if (! empty($audioFileTitle)) {
            return $audioFileTitle;
        }

        return $this->titleGeneratorService->generateDefaultDirectoryName();
    }

    private function generateTitleFromAudioFileName(
        AsrTaskStatusDTO $taskStatus,
        ?string $audioFileId,
        ?MagicUserAuthorization $userAuthorization
    ): ?string {
        if (empty($audioFileId)) {
            return null;
        }

        try {
            $fileEntity = $this->taskFileDomainService->getById((int) $audioFileId);
            if ($fileEntity === null) {
                return null;
            }

            $userAuthorization ??= $this->getUserAuthorizationFromUserId($taskStatus->userId);
            return $this->titleGeneratorService->generateTitleForFileUpload(
                $userAuthorization,
                $fileEntity->getFileName(),
                $taskStatus->taskKey
            );
        } catch (Throwable $e) {
            $this->logger->warning('根据音频文件名生成补齐标题失败', [
                'task_key' => $taskStatus->taskKey,
                'audio_file_id' => $audioFileId,
                'error' => $e->getMessage(),
            ]);
            return null;
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
                $dataIsolation = $this->createContactDataIsolationByUser($organizationCode, $userId);
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
     * finish-recording 后使用语义标题补齐空项目名，不覆盖用户已有命名.
     */
    private function renameProjectAfterFinishRecording(
        AsrTaskStatusDTO $taskStatus,
        string $generatedTitle,
        string $userId
    ): void {
        try {
            if (empty($taskStatus->projectId)) {
                return;
            }

            $projectName = $this->titleGeneratorService->sanitizeTitle($generatedTitle);
            if ($projectName === '' || $projectName === $this->translator->trans('asr.file_names.original_recording')) {
                return;
            }

            $projectEntity = $this->projectDomainService->getProject((int) $taskStatus->projectId, $userId);
            if (! empty(trim($projectEntity->getProjectName() ?? ''))) {
                return;
            }

            $projectEntity->setProjectName($projectName);
            $projectEntity->setUpdatedUid($userId);
            $this->projectDomainService->saveProjectEntity($projectEntity);

            $this->logger->info('finish-recording 后补齐项目名称成功', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
                'project_name' => $projectName,
            ]);
        } catch (Throwable $e) {
            $this->logger->warning('finish-recording 后补齐项目名称失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
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

        $this->setFinishRecoverableContext($taskStatus, $fileTitle);

        // Build DataIsolation once for downstream sandbox calls. Note
        // $taskStatus->userId is the record-ownership identity here.
        // 首次读取时才按用户查询授权 token。
        $dataIsolation = $this->createContactDataIsolationByUser($organizationCode, $taskStatus->userId);

        // Merge audio files and get merge result (includes duration and file_size)
        $mergeResult = $this->asrSandboxService->mergeAudioFiles(
            $dataIsolation,
            $taskStatus,
            $fileTitle,
            AsrTaskStatusEnum::COMPLETED,
        );
        $this->syncAsrRecoverableContextToDatabase($taskStatus);

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

            // 获取话题动态参数（如 message_version），用于透传给 super-magic
            $topicDynamicParams = null;
            if (! empty($dto->topicId)) {
                $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $dto->topicId);
                $topicDynamicParams = $topicEntity?->getDynamicParams();
            }

            // 构建聊天消息（包含笔记文件和标记文件）
            $chatRequest = $this->chatMessageAssembler->buildSummaryMessage($dto, $audioFileData, $noteFileData, $markerFileData, $topicDynamicParams);

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
                'topic_dynamic_params' => $topicDynamicParams,
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
     * 发送重新总结聊天消息.
     */
    private function sendResummaryChatMessage(
        ProcessSummaryTaskDTO $dto,
        MagicUserAuthorization $userAuthorization,
    ): void {
        $dedupAcquired = false;
        $dedupKey = null;
        try {
            $taskKey = $dto->taskStatus->taskKey ?? '';
            $userId = $dto->taskStatus->userId ?: $userAuthorization->getId();
            if ($taskKey !== '' && $userId !== '') {
                $requestId = (string) CoContext::getOrSetRequestId();
                $dedupKey = sprintf(
                    AsrRedisKeys::SUMMARY_CHAT_DEDUP,
                    md5($userId . ':' . $taskKey . ':resummary:' . $requestId)
                );
                $dedupAcquired = (bool) $this->redis->set($dedupKey, '1', ['nx', 'ex' => AsrConfig::SUMMARY_CHAT_DEDUP_TTL]);
                if (! $dedupAcquired) {
                    $this->logger->info('检测到重新总结聊天消息已发送，跳过重复发送', [
                        'task_key' => $taskKey,
                        'user_id' => $userId,
                        'dedup_key' => $dedupKey,
                    ]);
                    return;
                }
            }

            $audioFileData = $this->buildFileDataFromTaskStatus($dto->taskStatus);
            $noteFileData = $this->buildNoteFileDataFromTaskStatus($dto->taskStatus);
            $markerFileData = $this->buildMarkerFileDataFromTaskStatus($dto->taskStatus);

            $topicDynamicParams = null;
            if (! empty($dto->topicId)) {
                $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $dto->topicId);
                $topicDynamicParams = $topicEntity?->getDynamicParams();
            }

            $resummaryDynamicParams = [
                'summary_task' => true,
                're_summary_task' => true,
            ];
            $dynamicParams = array_merge($topicDynamicParams ?? [], $resummaryDynamicParams);

            $chatRequest = $this->chatMessageAssembler->buildResummaryMessage(
                $dto,
                $audioFileData,
                $noteFileData,
                $markerFileData,
                $dynamicParams
            );

            $messageData = $chatRequest->getData()->getMessage()->getMagicMessage();

            $this->logger->info('sendResummaryChatMessage 准备发送ASR重新总结聊天消息', [
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
                'topic_dynamic_params' => $topicDynamicParams,
                'is_queued' => $this->shouldQueueMessage($dto->topicId),
                'language' => CoContext::getLanguage(),
            ]);

            if ($this->shouldQueueMessage($dto->topicId)) {
                $this->queueChatMessage($dto, $chatRequest, $userAuthorization);
            } else {
                $this->magicChatMessageAppService->onChatMessage($chatRequest, $userAuthorization);
            }
        } catch (Throwable $e) {
            if ($dedupAcquired && $dedupKey !== null) {
                try {
                    $this->redis->del($dedupKey);
                } catch (Throwable) {
                    // ignore
                }
            }
            $this->logger->error('发送重新总结聊天消息失败', [
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
        $dataIsolation = $this->createContactDataIsolationByUser($userAuthorization->getOrganizationCode(), $userAuthorization->getId());
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
    private function handleStartRecording(DataIsolation $dataIsolation, AsrTaskStatusDTO $taskStatus): bool
    {
        // 每次 start 都检查沙箱是否存在，防止沙箱被回收导致音频丢失. 原因：如果暂停超过 20 分钟，沙箱可能被回收，需要重新启动以确保音频实时合并
        $started = false;
        try {
            $this->asrSandboxService->startRecordingTask($dataIsolation, $taskStatus);
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
        $this->syncAsrRecoverableContextToDatabase($taskStatus);
        // 更新状态并设置心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::START->value;
        $taskStatus->isPaused = false;
        $this->asrTaskDomainService->saveTaskStatusWithHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理录音心跳,检测沙箱是否还在实时运行，如果没有则重新拉起。
     */
    private function handleRecordingHeartbeat(DataIsolation $dataIsolation, AsrTaskStatusDTO $taskStatus): bool
    {
        $userId = $dataIsolation->getCurrentUserId();
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
                    $this->asrSandboxService->startRecordingTask($dataIsolation, $taskStatus);
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

        $this->syncAsrRecoverableContextToDatabase($taskStatus);
        // 更新状态并设置心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::RECORDING->value;
        $taskStatus->isPaused = false;
        $this->asrTaskDomainService->saveTaskStatusWithHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理暂停录音.
     */
    private function handlePauseRecording(DataIsolation $dataIsolation, AsrTaskStatusDTO $taskStatus): bool
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
    private function handleStopRecording(DataIsolation $dataIsolation, AsrTaskStatusDTO $taskStatus): bool
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
    private function handleCancelRecording(DataIsolation $dataIsolation, AsrTaskStatusDTO $taskStatus): bool
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
                $response = $this->asrSandboxService->cancelRecordingTask($dataIsolation, $taskStatus);
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
        $dataIsolation = $this->createContactDataIsolationByUser(
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
                $project = $this->projectDomainService->getProjectNotUserId((int) $taskStatus->projectId);
                $deleted = $this->projectDomainService->deleteProject((int) $taskStatus->projectId, $taskStatus->userId);
                if ($deleted && $project !== null) {
                    $authorization = (new MagicUserAuthorization())
                        ->setId($taskStatus->userId)
                        ->setOrganizationCode((string) $taskStatus->organizationCode);
                    $this->eventDispatcher->dispatch(new ProjectDeletedEvent($project, $authorization));
                }
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
     * 发送自动重新总结聊天消息.
     */
    private function sendAutoResummaryChatMessage(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode,
    ): void {
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
        $this->sendResummaryChatMessage($processSummaryTaskDTO, $userAuthorization);
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
     * Execute async finish-recording recovery in coroutine.
     */
    private function executeAsyncRecoverFinishRecording(
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
                $this->handleRecoverFinishRecording($taskKey, $userId, $organizationCode, $generatedTitle);
            } catch (Throwable $e) {
                $this->logger->error('Async finish recording recovery failed', [
                    'task_key' => $taskKey,
                    'error' => $e->getMessage(),
                ]);

                $this->failRecoverMergingPhaseIfPossible($taskKey, $userId, $organizationCode, $e->getMessage());
            }
        });
    }

    /**
     * Resolve finish-recording title with the same server-side trust model as /summary.
     */
    private function resolveFinishRecordingFileTitle(AsrTaskStatusDTO $taskStatus, ?string $requestGeneratedTitle): string
    {
        $generatedFromTask = $this->titleGeneratorService->generateNullableFromTaskStatus($taskStatus);
        $generatedFromTask = $this->titleGeneratorService->sanitizeTitle($generatedFromTask ?? '');
        if ($generatedFromTask !== '') {
            $this->logger->info('finish-recording 使用任务状态内容生成标题', [
                'task_key' => $taskStatus->taskKey,
                'title_source' => 'task_status',
                'has_asr_content' => ! empty($taskStatus->asrStreamContent),
                'has_note' => ! empty($taskStatus->noteContent),
            ]);
            return $generatedFromTask;
        }

        $uploadGeneratedTitle = $this->titleGeneratorService->sanitizeTitle($taskStatus->uploadGeneratedTitle ?? '');
        if ($uploadGeneratedTitle !== '') {
            $this->logger->info('finish-recording 使用 upload-tokens 生成的标题', [
                'task_key' => $taskStatus->taskKey,
                'title_source' => 'upload_generated_title',
            ]);
            return $uploadGeneratedTitle;
        }

        $requestTitle = $this->titleGeneratorService->sanitizeTitle($requestGeneratedTitle ?? '');
        if ($requestTitle !== '') {
            $this->logger->info('finish-recording 回退使用请求标题', [
                'task_key' => $taskStatus->taskKey,
                'title_source' => 'request_generated_title',
            ]);
            return $requestTitle;
        }

        return $this->translator->trans('asr.file_names.original_recording');
    }

    /**
     * Check if can manually trigger summary.
     */
    private function canManualSummarize(
        AsrTaskStatusDTO $taskStatus,
        AudioProjectEntity $audioProject
    ): bool {
        // 手动总结不再限制项目必须为手动模式（auto_summary），自动模式项目也允许手动补总结
        // 优先按 Redis 实时任务状态判断
        if ($taskStatus->status === AsrTaskStatusEnum::AUDIO_PROCESSED
            && $taskStatus->recordingStatus === AsrRecordingStatusEnum::STOPPED->value
            && ! empty($taskStatus->audioFileId)) {
            return true;
        }

        // Redis 状态不满足时，回退按数据库音频项目状态兜底，避免 Redis 与数据库不一致时误拒：
        // 已有合并产物（audio_file_id 非空）且尚未进入总结阶段
        return $audioProject->getAudioFileId() !== null
            && $audioProject->getCurrentPhase() !== AsrTaskStatusDTO::PHASE_SUMMARIZING;
    }

    private function canManualResummarize(AsrTaskStatusDTO $taskStatus): bool
    {
        return $taskStatus->recordingStatus === AsrRecordingStatusEnum::STOPPED->value
            && ! empty($taskStatus->audioFileId)
            && ! (
                $taskStatus->currentPhase === AsrTaskStatusDTO::PHASE_SUMMARIZING
                && $taskStatus->phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS
            );
    }
}
