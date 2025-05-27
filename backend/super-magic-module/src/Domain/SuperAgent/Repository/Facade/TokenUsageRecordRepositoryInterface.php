<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TokenUsageRecordEntity;

/**
 * Token使用记录仓储接口.
 */
interface TokenUsageRecordRepositoryInterface
{
    /**
     * Create a new token usage record.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TokenUsageRecordEntity $entity Token usage record entity
     * @return TokenUsageRecordEntity Created entity with ID
     */
    public function create(DataIsolation $dataIsolation, TokenUsageRecordEntity $entity): TokenUsageRecordEntity;

    /**
     * Get token usage record by ID.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $id Record ID
     * @return null|TokenUsageRecordEntity Token usage record entity or null if not found
     */
    public function getById(DataIsolation $dataIsolation, int $id): ?TokenUsageRecordEntity;

    /**
     * Get token usage records by task ID.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $taskId Task ID
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByTaskId(DataIsolation $dataIsolation, string $taskId): array;

    /**
     * Get token usage records by topic ID.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param int $topicId Topic ID
     * @return array Array of TokenUsageRecordEntity
     */
    public function getByTopicId(DataIsolation $dataIsolation, int $topicId): array;

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
    ): array;

    /**
     * Save token usage record.
     *
     * @param TokenUsageRecordEntity $entity Token usage record entity
     * @return TokenUsageRecordEntity Saved entity with ID
     */
    public function save(TokenUsageRecordEntity $entity): TokenUsageRecordEntity;

    /**
     * Find existing record by unique key for idempotency check.
     *
     * @param int $topicId Topic ID
     * @param string $taskId Task ID
     * @param null|string $sandboxId Sandbox ID
     * @param null|string $modelId Model ID
     * @return null|TokenUsageRecordEntity Existing record or null if not found
     */
    public function findByUniqueKey(int $topicId, string $taskId, ?string $sandboxId, ?string $modelId): ?TokenUsageRecordEntity;
}
