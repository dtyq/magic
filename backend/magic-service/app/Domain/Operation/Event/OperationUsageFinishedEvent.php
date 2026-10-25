<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Operation\Event;

use App\Infrastructure\Core\AbstractEvent;

class OperationUsageFinishedEvent extends AbstractEvent
{
    public const string STATUS_SUCCESS = 'success';

    public const string STATUS_FAILED = 'failed';

    public function __construct(
        protected string $executionKey,
        protected string $status,
        protected string $organizationCode,
        protected string $userId,
        protected ?string $sourceId = null,
        protected ?string $failureCode = null,
        protected ?string $failureReason = null,
    ) {
    }

    public function getExecutionKey(): string
    {
        return $this->executionKey;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function isSuccess(): bool
    {
        return $this->status === self::STATUS_SUCCESS;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
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

    public function getFailureCode(): ?string
    {
        return $this->failureCode;
    }

    public function getFailureReason(): ?string
    {
        return $this->failureReason;
    }
}
