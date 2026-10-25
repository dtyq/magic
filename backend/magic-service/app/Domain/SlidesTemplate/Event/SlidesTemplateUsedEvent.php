<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Event;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Infrastructure\Core\AbstractEvent;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class SlidesTemplateUsedEvent extends AbstractEvent
{
    protected ?string $eventId = null;

    public function __construct(
        protected string $organizationCode,
        protected string $sourceId,
        protected int $callTime,
        protected string $userId,
        protected string $userName,
        protected string $requestId,
        protected SlidesTemplateEntity $template,
        protected array $businessParams = [],
        ?string $eventId = null,
    ) {
        $this->eventId = $eventId ?: (string) ($businessParams['event_id'] ?? IdGenerator::getSnowId());
    }

    public function getEventId(): string
    {
        return $this->eventId ??= (string) ($this->businessParams['event_id'] ?? IdGenerator::getSnowId());
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

    public function getTemplate(): SlidesTemplateEntity
    {
        return $this->template;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function toArray(): array
    {
        return [
            'organization_code' => $this->organizationCode,
            'source_id' => $this->sourceId,
            'call_time' => $this->callTime,
            'user_id' => $this->userId,
            'user_name' => $this->userName,
            'request_id' => $this->requestId,
            'event_id' => $this->eventId,
            'template_code' => $this->template->getCode(),
            'business_params' => $this->businessParams,
        ];
    }
}
