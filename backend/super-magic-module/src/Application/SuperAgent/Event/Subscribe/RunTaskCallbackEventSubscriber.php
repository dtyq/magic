<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TokenUsageRecordAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TokenUsageRecordEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsage;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsageDetails;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TopicMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * RunTaskCallbackEvent事件监听器 - 记录Token使用情况.
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

        // Get TokenUsageDetails from the task message
        $tokenUsageDetails = $event->getTaskMessage()->getTokenUsageDetails();
        if ($tokenUsageDetails === null) {
            $this->logger->info('TokenUsageDetails is null, skipping record', [
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
            ]);
            return;
        }

        // Check if type is summary
        if ($tokenUsageDetails->getType() !== 'summary') {
            $this->logger->debug('TokenUsageDetails type is not summary, skipping record', [
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'type' => $tokenUsageDetails->getType(),
            ]);
            return;
        }

        // Record token usage
        $this->recordTokenUsage($event, $tokenUsageDetails);
    }

    /**
     * Record token usage.
     *
     * @param RunTaskCallbackEvent $event Event object
     * @param TokenUsageDetails $tokenUsageDetails Token usage details
     */
    private function recordTokenUsage(RunTaskCallbackEvent $event, TokenUsageDetails $tokenUsageDetails): void
    {
        try {
            // Get sandbox_id by task_id
            $sandboxId = $this->getSandboxIdByTaskId($event->getTaskId());

            // Get individual token usages
            $usages = $tokenUsageDetails->getUsages();
            if (empty($usages)) {
                $this->logger->info('No token usages found, skipping record', [
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                ]);
                return;
            }

            $recordsCreated = 0;
            $recordsSkipped = 0;

            // Process each usage separately
            foreach ($usages as $usage) {
                if (! $usage instanceof TokenUsage) {
                    continue;
                }

                $modelId = $usage->getModelId();
                $modelName = $usage->getModelName();

                // Check for idempotency - prevent duplicate records
                $tokenUsageRecordAppService = di(TokenUsageRecordAppService::class);
                $existingRecord = $tokenUsageRecordAppService->findByUniqueKey(
                    $event->getTopicId(),
                    (string) $event->getTaskId(),
                    $sandboxId,
                    $modelId
                );

                if ($existingRecord !== null) {
                    $this->logger->debug('Token usage record already exists for model, skipping duplicate', [
                        'task_id' => $event->getTaskId(),
                        'topic_id' => $event->getTopicId(),
                        'sandbox_id' => $sandboxId,
                        'model_id' => $modelId,
                        'existing_record_id' => $existingRecord->getId(),
                    ]);
                    ++$recordsSkipped;
                    continue;
                }

                // Get task status from task message payload
                $taskStatus = $event->getTaskMessage()->getPayload()->getStatus() ?? 'unknown';

                // Create TokenUsageRecordEntity for this specific model
                $entity = new TokenUsageRecordEntity();
                $entity->setTopicId($event->getTopicId());
                $entity->setTaskId((string) $event->getTaskId());
                $entity->setSandboxId($sandboxId);
                $entity->setOrganizationCode($event->getOrganizationCode());
                $entity->setUserId($event->getUserId());
                $entity->setTaskStatus($taskStatus);
                $entity->setUsageType($tokenUsageDetails->getType());

                // Set individual model statistics
                $entity->setTotalInputTokens($usage->getInputTokens() ?? 0);
                $entity->setTotalOutputTokens($usage->getOutputTokens() ?? 0);
                $entity->setTotalTokens($usage->getTotalTokens() ?? 0);
                $entity->setModelId($modelId);
                $entity->setModelName($modelName);

                // Set detailed token information
                $inputDetails = $usage->getInputTokensDetails();
                if ($inputDetails) {
                    $entity->setCachedTokens($inputDetails->getCachedTokens() ?? 0);
                    $entity->setCacheWriteTokens($inputDetails->getCacheWriteTokens() ?? 0);
                } else {
                    $entity->setCachedTokens(0);
                    $entity->setCacheWriteTokens(0);
                }

                $outputDetails = $usage->getOutputTokensDetails();
                if ($outputDetails) {
                    $entity->setReasoningTokens($outputDetails->getReasoningTokens() ?? 0);
                } else {
                    $entity->setReasoningTokens(0);
                }

                // Save original JSON data (entire TokenUsageDetails for context)
                $entity->setUsageDetails($tokenUsageDetails->toArray());

                // Save through application service
                $tokenUsageRecordAppService->createRecord($entity);

                $this->logger->debug('Token usage record saved successfully for model', [
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'sandbox_id' => $sandboxId,
                    'model_id' => $modelId,
                    'model_name' => $modelName,
                    'total_tokens' => $usage->getTotalTokens(),
                    'usage_type' => $tokenUsageDetails->getType(),
                ]);

                ++$recordsCreated;
            }

            $this->logger->info('Token usage records processing completed', [
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'sandbox_id' => $sandboxId,
                'records_created' => $recordsCreated,
                'records_skipped' => $recordsSkipped,
                'total_models' => count($usages),
                'usage_type' => $tokenUsageDetails->getType(),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to record token usage', [
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Get sandbox ID by task ID.
     *
     * @param int $taskId Task ID
     * @return null|string Sandbox ID or null if not found
     */
    private function getSandboxIdByTaskId(int $taskId): ?string
    {
        try {
            // Query task information through TaskDomainService to get sandbox_id
            $taskDomainService = di(TaskDomainService::class);
            $task = $taskDomainService->getTaskById($taskId);
            return $task?->getSandboxId();
        } catch (Throwable $e) {
            $this->logger->warning('Failed to get sandbox ID', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Check recording summary completion and send notification.
     * 检测录音总结是否完成，如果完成则推送通知.
     */
    private function checkRecordingSummaryCompletion(RunTaskCallbackEvent $event): void
    {
        try {
            // 获取话题信息
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
            if ($topicEntity->getTopicMode() !== TopicMode::SUMMARY) {
                return;
            }

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

            // 获取用户信息
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

            // 准备推送数据
            $pushData = [
                'workspace_id' => $topicEntity->getWorkspaceId(),
                'project_id' => $topicEntity->getProjectId(),
                'topic_id' => $topicEntity->getId(),
                'organization_code' => $event->getOrganizationCode(),
                'success' => $taskStatus === TaskStatus::FINISHED,
                'message_type' => 'recording_summary_result',
                'timestamp' => time(),
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
}
