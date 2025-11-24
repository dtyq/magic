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
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus as SuperAgentTaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Engine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR文件管理应用服务 - 负责ASR相关的核心业务编排.
 */
readonly class AsrFileAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private ProjectDomainService $projectDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private WorkspaceDomainService $workspaceDomainService,
        private MagicUserDomainService $magicUserDomainService,
        private ChatMessageAssembler $chatMessageAssembler,
        private MagicChatMessageAppService $magicChatMessageAppService,
        private MagicChatDomainService $magicChatDomainService,
        private TopicDomainService $superAgentTopicDomainService,
        private MessageQueueDomainService $messageQueueDomainService,
        private TranslatorInterface $translator,
        // 新注入的 Service
        private AsrTaskDomainService $asrTaskDomainService,
        private AsrValidationService $validationService,
        private AsrDirectoryService $directoryService,
        private AsrTitleGeneratorService $titleGeneratorService,
        private AsrSandboxService $asrSandboxService,
        private AsrPresetFileService $presetFileService,
        private LockerInterface $locker,
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
            $this->validationService->validateProjectAccess($summaryRequest->projectId, $userId, $organizationCode);

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
                $projectName = empty(trim($projectName)) ? $summaryRequest->generatedTitle : $projectName;
                $topicName = empty(trim($topicName)) ? $summaryRequest->generatedTitle : $topicName;
            }

            // 6. 异步执行录音总结流程
            $this->executeAsyncSummary($summaryRequest, $userAuthorization);

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
        $lockName = sprintf(AsrRedisKeys::SUMMARY_LOCK, $summaryRequest->taskKey);
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
                    $this->logger->info('检测到总结已完成，跳过重复处理，仅重新发送消息', [
                        'task_key' => $summaryRequest->taskKey,
                        'audio_file_id' => $taskStatus->audioFileId,
                        'status' => $taskStatus->status->value,
                    ]);

                    // 仅重新发送聊天消息（支持更换模型重新总结）
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
                    // 先生成新的显示目录路径并更新到 taskStatus（确保沙箱使用正确的目录）
                    //                    $oldDisplayDirectory = $taskStatus->displayDirectory;
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
                } catch (Throwable $mergeException) {
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

            // 7. 清理流式识别文件（总结完成后不再需要）
            if (! empty($taskStatus->presetTranscriptFileId)) {
                $this->presetFileService->deleteTranscriptFile($taskStatus->presetTranscriptFileId);
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
        return $this->validationService->validateProjectAccess($projectId, $userId, $organizationCode);
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
     * 准备录音目录.
     */
    public function prepareRecordingDirectories(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $taskKey
    ): array {
        $hiddenDir = $this->directoryService->createHiddenDirectory($organizationCode, $projectId, $userId, $taskKey);
        $displayDir = $this->directoryService->createDisplayDirectory($organizationCode, $projectId, $userId);
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
        string $taskKey
    ): array {
        // 验证话题和项目权限
        $this->validationService->validateTopicOwnership((int) $topicId, $userId);
        $this->validationService->validateProjectAccess($projectId, $userId, $organizationCode);

        // 准备录音目录
        return $this->prepareRecordingDirectories($organizationCode, $projectId, $userId, $taskKey);
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
        string $language,
        string $userId,
        string $organizationCode
    ): bool {
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            ExceptionBuilder::throw(AsrErrorCode::TaskNotExist);
        }

        // 保存 model_id、ASR 内容、笔记内容和语种
        $this->updateTaskStatusFromReport($taskStatus, $modelId, $asrStreamContent, $noteContent, $noteFileType, $language);

        // 根据状态处理
        return match ($status) {
            AsrRecordingStatusEnum::START => $this->handleStartRecording($taskStatus, $userId, $organizationCode),
            AsrRecordingStatusEnum::RECORDING => $this->handleRecordingHeartbeat($taskStatus),
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
        $lockName = sprintf(AsrRedisKeys::SUMMARY_LOCK, $taskStatus->taskKey);
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
            //            $oldDisplayDirectory = $taskStatus->displayDirectory;
            if (! empty($fileTitle)) {
                $newDisplayDirectory = $this->directoryService->getNewDisplayDirectory(
                    $taskStatus,
                    $fileTitle,
                    $this->titleGeneratorService
                );
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }

            // 合并音频（沙箱会重命名目录但不会通知文件变动）
            $this->asrSandboxService->mergeAudioFiles($taskStatus, $fileTitle, $organizationCode);

            // 发送聊天消息
            $this->sendAutoSummaryChatMessage($taskStatus, $userId, $organizationCode);

            $taskStatus->finishServerSummaryAttempt(true);

            // 标记任务为已完成（幂等性保证）
            $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
            $taskStatus->recordingStatus = AsrRecordingStatusEnum::STOPPED->value;
            $this->asrTaskDomainService->saveTaskStatus($taskStatus);

            // 清理流式识别文件（总结完成后不再需要）
            if (! empty($taskStatus->presetTranscriptFileId)) {
                $this->presetFileService->deleteTranscriptFile($taskStatus->presetTranscriptFileId);
            }

            $this->logger->info('自动总结完成', [
                'task_key' => $taskStatus->taskKey,
                'audio_file_id' => $taskStatus->audioFileId,
                'status' => $taskStatus->status->value,
            ]);
        } catch (Throwable $e) {
            $taskStatus->finishServerSummaryAttempt(false);
            $this->asrTaskDomainService->saveTaskStatus($taskStatus);

            $this->logger->error('自动总结失败', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 异步执行总结流程.
     */
    private function executeAsyncSummary(
        SummaryRequestDTO $summaryRequest,
        MagicUserAuthorization $userAuthorization
    ): void {
        $requestId = CoContext::getRequestId();
        // ⚠️ 重要：使用 CoContext::getLanguage() 而不是 translator->getLocale()
        // 因为后续的服务调用可能会修改 translator 的 locale，但 CoContext 中的语言不会被修改
        $language = CoContext::getLanguage();
        Coroutine::create(function () use ($summaryRequest, $userAuthorization, $language, $requestId) {
            // 在协程中需要重新获取 translator 实例并设置语言
            di(TranslatorInterface::class)->setLocale($language);
            CoContext::setLanguage($language);
            CoContext::setRequestId($requestId);

            try {
                $this->handleAsrSummary($summaryRequest, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
            } catch (Throwable $e) {
                $this->logger->error('协程执行ASR总结流程失败', [
                    'task_key' => $summaryRequest->taskKey,
                    'error' => $e->getMessage(),
                ]);
            }
        });
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
            $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
            $workspaceName = $workspaceEntity?->getName();

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
            if (empty(trim($projectEntity->getProjectName()))) {
                $projectEntity->setProjectName($generatedTitle);
                $projectEntity->setUpdatedUid($userId);
                $this->projectDomainService->saveProjectEntity($projectEntity);
            }

            // 更新话题名称
            $topicEntity = $this->superAgentTopicDomainService->getTopicById($topicId);
            if ($topicEntity && empty(trim($topicEntity->getTopicName()))) {
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
     */
    private function createVirtualTaskStatusFromFileId(
        SummaryRequestDTO $summaryRequest,
        string $userId,
        string $organizationCode
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
            'status' => AsrTaskStatusEnum::COMPLETED->value,
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

        $this->asrSandboxService->mergeAudioFiles($taskStatus, $fileTitle, $organizationCode);
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
     * 发送总结聊天消息.
     */
    private function sendSummaryChatMessage(ProcessSummaryTaskDTO $dto, MagicUserAuthorization $userAuthorization): void
    {
        try {
            // 构建音频文件数据
            $audioFileData = $this->buildFileDataFromTaskStatus($dto->taskStatus);

            // 构建笔记文件数据（如果存在）
            $noteFileData = $this->buildNoteFileDataFromTaskStatus($dto->taskStatus);

            // 构建聊天消息（包含笔记文件）
            $chatRequest = $this->chatMessageAssembler->buildSummaryMessage($dto, $audioFileData, $noteFileData);

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
        try {
            $this->asrSandboxService->startRecordingTask($taskStatus, $userId, $organizationCode);
            $taskStatus->sandboxRetryCount = 0; // 成功后重置重试次数
        } catch (Throwable $e) {
            // 沙箱启动失败时记录日志但继续处理（沙箱可能临时不可用）
            ++$taskStatus->sandboxRetryCount;
            $this->logger->warning('沙箱任务启动失败，将在后续自动重试', [
                'task_key' => $taskStatus->taskKey,
                'retry_count' => $taskStatus->sandboxRetryCount,
                'error' => $e->getMessage(),
            ]);
        }
        $taskStatus->sandboxTaskCreated = true; // 重置标志
        // 更新状态并设置心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::START->value;
        $taskStatus->isPaused = false;
        $this->asrTaskDomainService->saveTaskStatusWithHeartbeat($taskStatus);

        return true;
    }

    /**
     * 处理录音心跳.
     */
    private function handleRecordingHeartbeat(AsrTaskStatusDTO $taskStatus): bool
    {
        // 更新状态并设置心跳（原子操作）
        $taskStatus->recordingStatus = AsrRecordingStatusEnum::RECORDING->value;
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
            $projectEntity = $this->projectDomainService->getProject((int) $taskStatus->projectId, $taskStatus->userId);
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
}
