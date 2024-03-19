<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use DateTimeImmutable;

/**
 * Domain event dispatched after project ownership is transferred.
 *
 * This event can be used to trigger:
 * - Notifications to involved users
 * - Cache invalidation
 * - Third-party integrations
 */
class ProjectTransferredEvent extends AbstractEvent
{
    public function __construct(
        public readonly int $projectId,
        public readonly string $projectName,
        public readonly string $fromUserId,
        public readonly string $toUserId,
        public readonly string $organizationCode,
        public readonly bool $shareToOriginal,
        public readonly string $shareRole,
        public readonly DateTimeImmutable $transferredAt,
    ) {
        parent::__construct();
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function getFromUserId(): string
    {
        return $this->fromUserId;
    }

    public function getToUserId(): string
    {
        return $this->toUserId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function isShareToOriginal(): bool
    {
        return $this->shareToOriginal;
    }

    public function getShareRole(): string
    {
        return $this->shareRole;
    }

    public function getTransferredAt(): DateTimeImmutable
    {
        return $this->transferredAt;
    }
}
