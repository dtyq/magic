<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TokenUsageRecordAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TokenUsageRecordEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsage;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsageDetails;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
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
        private readonly TokenUsageRecordAppService $tokenUsageRecordAppService,
        private readonly TaskDomainService $taskDomainService,
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
                $existingRecord = $this->tokenUsageRecordAppService->findByUniqueKey(
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
                $this->tokenUsageRecordAppService->createRecord($entity);

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
            $task = $this->taskDomainService->getTaskById($taskId);
            return $task?->getSandboxId();
        } catch (Throwable $e) {
            $this->logger->warning('Failed to get sandbox ID', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
