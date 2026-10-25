<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Operation\Event;

use App\Infrastructure\Core\AbstractEvent;

class OperationUsageWillStartEvent extends AbstractEvent
{
    public function __construct(
        protected string $executionKey,
        protected string $operationName,
        protected string $organizationCode,
        protected string $userId,
        protected ?string $sourceId = null,
        protected array $usage = [],
        protected array $businessParams = [],
    ) {
    }

    public function getExecutionKey(): string
    {
        return $this->executionKey;
    }

    public function getOperationName(): string
    {
        return $this->operationName;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }

    public function getUsage(): array
    {
        return $this->usage;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }
}
