<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TokenUsageRecordEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TokenUsageRecordRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Token使用记录领域服务.
 */
class TokenUsageRecordDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly TokenUsageRecordRepositoryInterface $tokenUsageRecordRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Create a new token usage record.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TokenUsageRecordEntity $entity Token usage record entity
     * @return TokenUsageRecordEntity Created entity with ID
     */
    public function create(DataIsolation $dataIsolation, TokenUsageRecordEntity $entity): TokenUsageRecordEntity
    {
        return $this->tokenUsageRecordRepository->create($dataIsolation, $entity);
    }

    /**
     * Get token usage record by ID.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $id Record ID
     * @return null|TokenUsageRecordEntity Token usage record entity or null if not found
     */
    public function getById(DataIsolation $dataIsolation, int $id): ?TokenUsageRecordEntity
    {
        return $this->tokenUsageRecordRepository->getById($dataIsolation, $id);
    }

    /**
     * Get token usage records by task ID.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $taskId Task ID
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByTaskId(DataIsolation $dataIsolation, string $taskId): array
    {
        return $this->tokenUsageRecordRepository->getByTaskId($dataIsolation, $taskId);
    }

    /**
     * Get token usage records by topic ID.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $topicId Topic ID
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByTopicId(DataIsolation $dataIsolation, int $topicId): array
    {
        return $this->tokenUsageRecordRepository->getByTopicId($dataIsolation, $topicId);
    }

    /**
     * Get token usage records by organization and user.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param null|string $startDate Start date (Y-m-d H:i:s format)
     * @param null|string $endDate End date (Y-m-d H:i:s format)
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByOrganizationAndUser(
        DataIsolation $dataIsolation,
        string $organizationCode,
        string $userId,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        return $this->tokenUsageRecordRepository->getByOrganizationAndUser(
            $dataIsolation,
            $organizationCode,
            $userId,
            $startDate,
            $endDate
        );
    }

    /**
     * Calculate total tokens for a specific task.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $taskId Task ID
     * @return array Array with total statistics
     */
    public function calculateTaskTokens(DataIsolation $dataIsolation, string $taskId): array
    {
        $records = $this->getByTaskId($dataIsolation, $taskId);

        $totalInputTokens = 0;
        $totalOutputTokens = 0;
        $totalTokens = 0;
        $totalCachedTokens = 0;
        $totalCacheWriteTokens = 0;
        $totalReasoningTokens = 0;

        foreach ($records as $record) {
            $totalInputTokens += $record->getTotalInputTokens();
            $totalOutputTokens += $record->getTotalOutputTokens();
            $totalTokens += $record->getTotalTokens();
            $totalCachedTokens += $record->getCachedTokens();
            $totalCacheWriteTokens += $record->getCacheWriteTokens();
            $totalReasoningTokens += $record->getReasoningTokens();
        }

        return [
            'total_input_tokens' => $totalInputTokens,
            'total_output_tokens' => $totalOutputTokens,
            'total_tokens' => $totalTokens,
            'total_cached_tokens' => $totalCachedTokens,
            'total_cache_write_tokens' => $totalCacheWriteTokens,
            'total_reasoning_tokens' => $totalReasoningTokens,
            'record_count' => count($records),
        ];
    }

    /**
     * Create a new token usage record.
     *
     * @param TokenUsageRecordEntity $entity Token usage record entity
     * @return TokenUsageRecordEntity Created entity with ID
     */
    public function createRecord(TokenUsageRecordEntity $entity): TokenUsageRecordEntity
    {
        try {
            // Validate entity
            $this->validateEntity($entity);

            // Save through repository
            $savedEntity = $this->tokenUsageRecordRepository->save($entity);

            $this->logger->info('Token usage record created successfully', [
                'id' => $savedEntity->getId(),
                'topic_id' => $savedEntity->getTopicId(),
                'task_id' => $savedEntity->getTaskId(),
                'total_tokens' => $savedEntity->getTotalTokens(),
            ]);

            return $savedEntity;
        } catch (Throwable $e) {
            $this->logger->error('Failed to create token usage record', [
                'topic_id' => $entity->getTopicId(),
                'task_id' => $entity->getTaskId(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Find existing record by unique key for idempotency check.
     *
     * @param int $topicId Topic ID
     * @param string $taskId Task ID
     * @param null|string $sandboxId Sandbox ID
     * @param null|string $modelId Model ID
     * @return null|TokenUsageRecordEntity Existing record or null if not found
     */
    public function findByUniqueKey(int $topicId, string $taskId, ?string $sandboxId, ?string $modelId): ?TokenUsageRecordEntity
    {
        try {
            return $this->tokenUsageRecordRepository->findByUniqueKey($topicId, $taskId, $sandboxId, $modelId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to find token usage record by unique key', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'sandbox_id' => $sandboxId,
                'model_id' => $modelId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Validate token usage record entity.
     *
     * @param TokenUsageRecordEntity $entity Entity to validate
     * @throws InvalidArgumentException If validation fails
     */
    private function validateEntity(TokenUsageRecordEntity $entity): void
    {
        if (empty($entity->getTopicId())) {
            throw new InvalidArgumentException('Topic ID is required');
        }

        if (empty($entity->getTaskId())) {
            throw new InvalidArgumentException('Task ID is required');
        }

        if (empty($entity->getOrganizationCode())) {
            throw new InvalidArgumentException('Organization code is required');
        }

        if (empty($entity->getUserId())) {
            throw new InvalidArgumentException('User ID is required');
        }

        if ($entity->getTotalTokens() < 0) {
            throw new InvalidArgumentException('Total tokens cannot be negative');
        }
    }
}
