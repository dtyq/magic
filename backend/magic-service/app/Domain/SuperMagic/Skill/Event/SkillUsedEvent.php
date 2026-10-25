<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Event;

use App\Infrastructure\Core\AbstractEvent;

/** Indicates that a skill was used. */
class SkillUsedEvent extends AbstractEvent
{
    public function __construct(
        protected string $organizationCode,
        protected string $sourceId,
        protected int $callTime,
        protected string $userId,
        protected string $userName,
        protected string $requestId,
        protected string $skillCode,
        protected array $businessParams = [],
    ) {
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function getCallTime(): int
    {
        return $this->callTime;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getUserName(): string
    {
        return $this->userName;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function getSkillCode(): string
    {
        return $this->skillCode;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }
}
