<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AudioProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Hyperf\Codec\Json;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * RunTaskCallbackEvent事件监听器 - 录音总结完成检测.
 */
#[AsyncListener]
#[Listener]
class RunTaskCallbackEventSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Listen to events.
     *
     * @return array Array of event classes to listen to
     */
    public function listen(): array
    {
        return [
            RunTaskCallbackEvent::class,
        ];
    }

    /**
     * Process the event.
     *
     * @param object $event Event object
     */
    public function process(object $event): void
    {
        // Type check
        if (! $event instanceof RunTaskCallbackEvent) {
            return;
        }

        // Check recording summary completion
        $this->checkRecordingSummaryCompletion($event);
    }

    /**
     * Check recording summary completion and send notification.
     * 检测录音总结是否完成，如果完成则推送通知.
     */
    private function checkRecordingSummaryCompletion(RunTaskCallbackEvent $event): void
    {
        try {
            // 1. 检查任务状态
            $status = $event->getTaskMessage()->getPayload()->getStatus();
            $taskStatus = TaskStatus::tryFrom($status);
            if ($taskStatus === null) {
                $this->logger->warning('checkRecordingSummary Task status not found for recording summary check', [
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'status' => $status,
                ]);
                return;
            }
            // 检查任务状态是否为 ERROR 或 FINISHED
            if ($taskStatus !== TaskStatus::ERROR && $taskStatus !== TaskStatus::FINISHED) {
                return;
            }

            // 2. 查询该任务的用户消息，检查是否有 summary_task 标记
            // 使用 topicId + taskId + sender_type 查询，利用索引并只返回用户消息
            $taskMessageRepository = di(TaskMessageRepositoryInterface::class);
            $userMessages = $taskMessageRepository->findUserMessagesByTopicIdAndTaskId($event->getTopicId(), (string) $event->getTaskId());

            $hasSummaryTask = false;
            foreach ($userMessages as $message) {
                $rawContent = $message->getRawContent();
                if (! empty($rawContent)) {
                    // raw_content 直接存储的就是 dynamic_params 的 JSON
                    $dynamicParams = Json::decode($rawContent);
                    if (isset($dynamicParams['summary_task'])
                        && $dynamicParams['summary_task'] === true) {
                        $hasSummaryTask = true;
                        $this->logger->info('checkRecordingSummary Found summary_task marker', [
                            'task_id' => $event->getTaskId(),
                            'topic_id' => $event->getTopicId(),
                        ]);
                        break;
                    }
                }
            }

            // 3. 如果没有 summary_task 标记，则不推送通知
            if (! $hasSummaryTask) {
                $this->logger->debug('checkRecordingSummary No summary_task marker found, skipping notification', [
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                ]);
                return;
            }

            // 4. 获取话题信息并检查模式（双重保障）
            $topicDomainService = di(TopicDomainService::class);
            $topicEntity = $topicDomainService->getTopicById($event->getTopicId());
            if ($topicEntity === null) {
                $this->logger->warning('checkRecordingSummary Topic not found for recording summary check', [
                    'topic_id' => $event->getTopicId(),
                    'task_id' => $event->getTaskId(),
                ]);
                return;
            }

            // 检查话题模式是否为 summary
            if ($topicEntity->getTopicMode() !== ProjectMode::SUMMARY->value) {
                return;
            }

            // 5. 获取用户信息并推送通知
            $userId = $event->getUserId();
            $magicUserDomainService = di(MagicUserDomainService::class);
            $userEntity = $magicUserDomainService->getUserById($userId);

            if ($userEntity === null) {
                $this->logger->warning('checkRecordingSummary User not found for recording summary notification', [
                    'user_id' => $userId,
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                ]);
                return;
            }

            // 通过领域服务查询项目和工作区名称（只能依赖 domain/app 层）
            $projectName = '';
            $workspaceName = '';
            $projectEntity = null;
            try {
                $projectDomainService = di(ProjectDomainService::class);
                $projectEntity = $projectDomainService->getProjectNotUserId($topicEntity->getProjectId());
                $projectName = $projectEntity?->getProjectName() ?? '';

                $workspaceDomainService = di(WorkspaceDomainService::class);
                $workspace = $workspaceDomainService->getWorkspaceDetail($topicEntity->getWorkspaceId());
                $workspaceName = $workspace?->getName() ?? '';
            } catch (Throwable $e) {
                $this->logger->warning('checkRecordingSummary fetch project/workspace name failed', [
                    'topic_id' => $event->getTopicId(),
                    'project_id' => $topicEntity->getProjectId(),
                    'workspace_id' => $topicEntity->getWorkspaceId(),
                    'error' => $e->getMessage(),
                ]);
            }

            // Update audio project summarizing phase status (only for AUDIO or SUMMARY projects)
            $this->updateAudioProjectPhaseStatus(
                $event,
                $taskStatus,
                (int) $topicEntity->getProjectId(),
                $projectEntity
            );

            // 准备推送数据
            $pushData = [
                'type' => 'recording_summary_result',
                'recording_summary_result' => [
                    'workspace_id' => (string) $topicEntity->getWorkspaceId(),
                    'workspace_name' => $workspaceName,
                    'project_id' => (string) $topicEntity->getProjectId(),
                    'project_name' => $projectName,
                    'topic_id' => (string) $topicEntity->getId(),
                    'organization_code' => $event->getOrganizationCode(),
                    'success' => $taskStatus === TaskStatus::FINISHED,
                    'timestamp' => time(),
                ],
            ];

            // 推送消息给客户端
            SocketIOUtil::sendIntermediate(
                SocketEventType::Intermediate,
                $userEntity->getMagicId(),
                $pushData
            );

            $this->logger->info('checkRecordingSummary 录音总结完成通知已推送', [
                'user_id' => $userId,
                'magic_id' => $userEntity->getMagicId(),
                'topic_id' => $topicEntity->getId(),
                'task_id' => $event->getTaskId(),
                'status' => $taskStatus->value,
                'success' => $taskStatus === TaskStatus::FINISHED,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('checkRecordingSummary Failed to send recording summary completion notification', [
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'user_id' => $event->getUserId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Update audio project phase status (only for AUDIO or SUMMARY projects).
     */
    private function updateAudioProjectPhaseStatus(
        RunTaskCallbackEvent $event,
        TaskStatus $taskStatus,
        int $projectId,
        ?ProjectEntity $projectEntity
    ): void {
        try {
            // Check if project exists
            if ($projectEntity === null) {
                return;
            }

            // Check if project mode is AUDIO or SUMMARY
            $projectMode = $projectEntity->getProjectMode();
            if (! in_array($projectMode, [ProjectMode::AUDIO->value, ProjectMode::SUMMARY->value], true)) {
                return;
            }

            // ===== Step 1: Get audio_project to obtain task_key =====
            $audioProjectDomainService = di(AudioProjectDomainService::class);
            $audioProject = $audioProjectDomainService->getAudioProjectByProjectId($projectId);

            if ($audioProject === null) {
                $this->logger->warning('Audio project not found for callback', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                ]);
                return;
            }

            $taskKey = $audioProject->getTaskKey();
            if (empty($taskKey)) {
                $this->logger->warning('Audio project task key not found for callback', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                ]);
                return;
            }

            // ===== Step 2: Try to update via AsrTaskDomainService (Redis + Database) =====
            try {
                $asrTaskDomainService = di(AsrTaskDomainService::class);

                // Try to get taskStatus from Redis (may be expired)
                $asrTaskStatus = $asrTaskDomainService->findTaskByKey($taskKey, $event->getUserId());

                if ($asrTaskStatus === null) {
                    // Rebuild from database if Redis is empty
                    $asrTaskStatus = $asrTaskDomainService->rebuildFromDatabase($taskKey, $event->getUserId());
                }

                if ($asrTaskStatus !== null) {
                    // Use AsrTaskDomainService to update state (ensures Redis + DB dual-write)
                    if ($taskStatus === TaskStatus::FINISHED) {
                        $asrTaskDomainService->completeSummarizingPhase($asrTaskStatus);

                        $this->logger->info('Audio project summarizing phase completed via AsrTaskDomainService', [
                            'project_id' => $projectId,
                            'task_key' => $taskKey,
                            'task_id' => $event->getTaskId(),
                            'topic_id' => $event->getTopicId(),
                            'project_mode' => $projectMode,
                        ]);
                    } elseif ($taskStatus === TaskStatus::ERROR) {
                        $errorMessage = 'AI task failed';
                        $asrTaskDomainService->failSummarizingPhase($asrTaskStatus, $errorMessage);

                        $this->logger->warning('Audio project summarizing phase failed via AsrTaskDomainService', [
                            'project_id' => $projectId,
                            'task_key' => $taskKey,
                            'task_id' => $event->getTaskId(),
                            'topic_id' => $event->getTopicId(),
                            'project_mode' => $projectMode,
                            'error' => $errorMessage,
                        ]);
                    }

                    return; // ✅ Successfully updated via AsrTaskDomainService, return directly
                }
            } catch (Throwable $domainServiceError) {
                $this->logger->warning('Failed to update via AsrTaskDomainService, fallback to direct update', [
                    'project_id' => $projectId,
                    'task_key' => $taskKey,
                    'error' => $domainServiceError->getMessage(),
                ]);
                // Continue to fallback logic
            }

            // ===== Step 3: Fallback - Direct database update (only when AsrTaskDomainService cannot update) =====
            // This may happen when:
            // 1. Redis and database both have no task status record
            // 2. AsrTaskDomainService update failed

            $this->logger->info('Fallback to direct database update', [
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'reason' => 'task_status_not_found',
            ]);

            if ($taskStatus === TaskStatus::FINISHED) {
                $audioProject->completeSummarizingPhase();
                $audioProjectDomainService->save($audioProject);

                $this->logger->info('Audio project summarizing phase completed via direct update', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'project_mode' => $projectMode,
                ]);
            } elseif ($taskStatus === TaskStatus::ERROR) {
                $errorMessage = 'AI task failed';
                $audioProject->failSummarizingPhase($errorMessage);
                $audioProjectDomainService->save($audioProject);

                $this->logger->warning('Audio project summarizing phase failed via direct update', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'project_mode' => $projectMode,
                    'error' => $errorMessage,
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('Failed to update audio project phase', [
                'project_id' => $projectId,
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'task_status' => $taskStatus->value,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
