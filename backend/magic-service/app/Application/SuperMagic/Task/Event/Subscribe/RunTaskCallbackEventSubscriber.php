<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Event\Subscribe;

use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\File\Constant\AudioProjectPhaseEnum;
use App\Domain\SuperMagic\File\Constant\AudioProjectPhaseStatusEnum;
use App\Domain\SuperMagic\File\Service\AudioProjectDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Event\RunTaskCallbackEvent;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
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

            // 2. 获取话题信息并检查模式（topic_mode 决定业务域，audio_project phase 决定流程状态）
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

            // 3. 获取用户信息（用于后续推送通知）
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

            // 4. 更新录音项目总结阶段状态，仅在实际处理了总结阶段状态时才推送通知
            $phaseHandled = $this->updateAudioProjectPhaseStatus(
                $event,
                $taskStatus,
                (int) $topicEntity->getProjectId(),
                $projectEntity
            );

            if (! $phaseHandled) {
                return;
            }

            // 5. 准备推送数据
            $pushData = [
                'type' => 'recording_summary_result',
                'recording_summary_result' => [
                    'workspace_id' => (string) $topicEntity->getWorkspaceId(),
                    'workspace_name' => $workspaceName,
                    'project_id' => (string) $topicEntity->getProjectId(),
                    'project_name' => $projectName,
                    'project_mode' => $projectEntity->getProjectMode(),
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
     *
     * @return bool 是否实际处理了总结阶段状态（用于决定是否需要推送完成通知）
     */
    private function updateAudioProjectPhaseStatus(
        RunTaskCallbackEvent $event,
        TaskStatus $taskStatus,
        int $projectId,
        ?ProjectEntity $projectEntity
    ): bool {
        try {
            // Check if project exists
            if ($projectEntity === null) {
                return false;
            }

            // Check if project mode is AUDIO or SUMMARY
            $projectMode = $projectEntity->getProjectMode();
            if (! in_array($projectMode, [ProjectMode::AUDIO->value, ProjectMode::SUMMARY->value], true)) {
                return false;
            }

            // ===== Step 1: Get audio_project and check the summarizing lifecycle state =====
            $audioProjectDomainService = di(AudioProjectDomainService::class);
            $audioProject = $audioProjectDomainService->getAudioProjectByProjectId($projectId);

            if ($audioProject === null) {
                $this->logger->warning('Audio project not found for callback', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                ]);
                return false;
            }

            // 只处理仍处于总结生命周期的项目：
            // - in_progress：首次总结任务结束，按任务终态收敛 phase
            // - failed + finished：总结失败后的 follow-up 任务成功，允许重试收敛为 completed
            // - completed：已完成，重复回调或总结后的普通聊天直接幂等跳过
            // - failed + error：首次失败已记录，跳过重复失败处理
            if ($audioProject->getCurrentPhase() !== AudioProjectPhaseEnum::SUMMARIZING->value) {
                $this->logger->debug('Audio project is not in summarizing phase, skip callback', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'current_phase' => $audioProject->getCurrentPhase(),
                ]);
                return false;
            }

            $previousPhaseStatus = $audioProject->getPhaseStatus();
            $isRetrySuccess = $previousPhaseStatus === AudioProjectPhaseStatusEnum::FAILED->value
                && $taskStatus === TaskStatus::FINISHED;
            if ($previousPhaseStatus !== AudioProjectPhaseStatusEnum::IN_PROGRESS->value && ! $isRetrySuccess) {
                $this->logger->debug('Audio project summarizing phase already settled, skip callback', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'task_status' => $taskStatus->value,
                    'phase_status' => $previousPhaseStatus,
                ]);
                return false;
            }

            $taskKey = $audioProject->getTaskKey();
            if (empty($taskKey)) {
                $this->logger->warning('Audio project task key not found for callback', [
                    'project_id' => $projectId,
                    'task_id' => $event->getTaskId(),
                ]);
                return false;
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
                            'previous_phase_status' => $previousPhaseStatus,
                            'next_phase_status' => AudioProjectPhaseStatusEnum::COMPLETED->value,
                            'source' => 'topic_mode_and_audio_project_phase',
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
                            'previous_phase_status' => $previousPhaseStatus,
                            'next_phase_status' => AudioProjectPhaseStatusEnum::FAILED->value,
                            'source' => 'topic_mode_and_audio_project_phase',
                            'error' => $errorMessage,
                        ]);
                    }

                    return true; // ✅ Successfully updated via AsrTaskDomainService, return directly
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
                    'previous_phase_status' => $previousPhaseStatus,
                    'next_phase_status' => AudioProjectPhaseStatusEnum::COMPLETED->value,
                    'source' => 'topic_mode_and_audio_project_phase',
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
                    'previous_phase_status' => $previousPhaseStatus,
                    'next_phase_status' => AudioProjectPhaseStatusEnum::FAILED->value,
                    'source' => 'topic_mode_and_audio_project_phase',
                    'error' => $errorMessage,
                ]);
            }

            return true;
        } catch (Throwable $e) {
            $this->logger->error('Failed to update audio project phase', [
                'project_id' => $projectId,
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'task_status' => $taskStatus->value,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }
}
