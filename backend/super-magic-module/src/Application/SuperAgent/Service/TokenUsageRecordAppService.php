<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TokenUsageRecordEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TokenUsageRecordDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Token使用记录应用服务.
 */
class TokenUsageRecordAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly TokenUsageRecordDomainService $tokenUsageRecordDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Create a new token usage record.
     *
     * @param TokenUsageRecordEntity $entity Token usage record entity
     * @return TokenUsageRecordEntity Created entity with ID
     * @throws Throwable
     */
    public function createRecord(TokenUsageRecordEntity $entity): TokenUsageRecordEntity
    {
        try {
            // Create data isolation context based on organization code
            $dataIsolation = DataIsolation::create($entity->getOrganizationCode(), $entity->getUserId());

            // Create the record through domain service
            $createdEntity = $this->tokenUsageRecordDomainService->create($dataIsolation, $entity);

            $this->logger->info('Token usage record created successfully', [
                'id' => $createdEntity->getId(),
                'task_id' => $createdEntity->getTaskId(),
                'topic_id' => $createdEntity->getTopicId(),
                'total_tokens' => $createdEntity->getTotalTokens(),
                'usage_type' => $createdEntity->getUsageType(),
            ]);

            return $createdEntity;
        } catch (Throwable $e) {
            $this->logger->error('Failed to create token usage record', [
                'task_id' => $entity->getTaskId(),
                'topic_id' => $entity->getTopicId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
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
        return $this->tokenUsageRecordDomainService->findByUniqueKey($topicId, $taskId, $sandboxId, $modelId);
    }

    /**
     * Get token usage record by ID.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param int $id Record ID
     * @return null|TokenUsageRecordEntity Token usage record entity or null if not found
     */
    public function getById(string $organizationCode, string $userId, int $id): ?TokenUsageRecordEntity
    {
        try {
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            return $this->tokenUsageRecordDomainService->getById($dataIsolation, $id);
        } catch (Throwable $e) {
            $this->logger->error('Failed to get token usage record by ID', [
                'id' => $id,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get token usage records by task ID.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param string $taskId Task ID
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByTaskId(string $organizationCode, string $userId, string $taskId): array
    {
        try {
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            return $this->tokenUsageRecordDomainService->getByTaskId($dataIsolation, $taskId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to get token usage records by task ID', [
                'task_id' => $taskId,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Get token usage records by topic ID.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param int $topicId Topic ID
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByTopicId(string $organizationCode, string $userId, int $topicId): array
    {
        try {
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            return $this->tokenUsageRecordDomainService->getByTopicId($dataIsolation, $topicId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to get token usage records by topic ID', [
                'topic_id' => $topicId,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Get token usage records by organization and user.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param null|string $startDate Start date (Y-m-d H:i:s format)
     * @param null|string $endDate End date (Y-m-d H:i:s format)
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByOrganizationAndUser(
        string $organizationCode,
        string $userId,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        try {
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            return $this->tokenUsageRecordDomainService->getByOrganizationAndUser(
                $dataIsolation,
                $organizationCode,
                $userId,
                $startDate,
                $endDate
            );
        } catch (Throwable $e) {
            $this->logger->error('Failed to get token usage records by organization and user', [
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Calculate total tokens for a specific task.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param string $taskId Task ID
     * @return array Array with total statistics
     */
    public function calculateTaskTokens(string $organizationCode, string $userId, string $taskId): array
    {
        try {
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            return $this->tokenUsageRecordDomainService->calculateTaskTokens($dataIsolation, $taskId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to calculate task tokens', [
                'task_id' => $taskId,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return [
                'total_input_tokens' => 0,
                'total_output_tokens' => 0,
                'total_tokens' => 0,
                'total_cached_tokens' => 0,
                'total_cache_write_tokens' => 0,
                'total_reasoning_tokens' => 0,
                'record_count' => 0,
            ];
        }
    }
}
