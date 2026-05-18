<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;

/**
 * Data-access facade for the warm-pool sandboxes table.
 *
 * Implementations must be safe to call from concurrent crontab workers
 * and request handlers — the `claimOneReady*` helper is expected to use
 * `SELECT ... FOR UPDATE SKIP LOCKED` so that two consumers never grab
 * the same row.
 */
interface WarmPoolSandboxRepositoryInterface
{
    /**
     * Persist a brand-new entry (status = creating) and return the saved
     * entity with its DB-assigned ID populated.
     */
    public function insert(WarmPoolSandboxEntity $entity): WarmPoolSandboxEntity;

    public function findById(int $id): ?WarmPoolSandboxEntity;

    public function findBySandboxId(string $sandboxId): ?WarmPoolSandboxEntity;

    /**
     * @return WarmPoolSandboxEntity[]
     */
    public function findExpired(string $now, int $limit = 100): array;

    /**
     * @param string[] $statuses
     * @return WarmPoolSandboxEntity[]
     */
    public function findByImageAndStatuses(string $agentImage, array $statuses, int $limit = 100): array;

    /**
     * Find ready entries whose image is NOT the given one (stale generation).
     *
     * @return WarmPoolSandboxEntity[]
     */
    public function findReadyExcludingImage(string $currentAgentImage, int $limit = 100): array;

    public function countByImageAndStatuses(string $agentImage, array $statuses): int;

    /**
     * Atomically claim ONE `ready` row matching the given image and stamp
     * status/bound_* columns to `claimed`/<user>/<project>. Uses
     * `FOR UPDATE SKIP LOCKED` so concurrent claimers don't collide.
     *
     * Returns the claimed entity (post-update) or null if none available.
     */
    public function claimOneReady(
        string $agentImage,
        string $userId,
        string $projectId,
        string $now
    ): ?WarmPoolSandboxEntity;

    public function updateStatus(int $id, string $status, ?string $deadReason = null): bool;

    public function markReady(int $id): bool;

    public function deleteById(int $id): bool;

    /**
     * Most recently observed agent_image stored in the warm pool. Used to
     * detect generation changes without an event bus.
     */
    public function findLatestAgentImage(): ?string;
}
