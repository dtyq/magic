<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class DeleteWorkspaceAfterEvent
{
    public function __construct(
        private int $workspaceId,
        private string $organizationCode,
        private string $userId,
    ) {
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }
}
