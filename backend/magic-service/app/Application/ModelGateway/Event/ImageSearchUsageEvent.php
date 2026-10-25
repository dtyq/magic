<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

class ImageSearchUsageEvent
{
    private ?string $eventId = null;

    public function __construct(
        public string $engine,
        public string $organizationCode,
        public string $userId,
        public array $businessParams = [],
        ?string $eventId = null,
    ) {
        $this->eventId = $eventId ?: (string) ($businessParams['event_id'] ?? IdGenerator::getSnowId());
    }

    public function getEventId(): string
    {
        return $this->eventId ??= (string) ($this->businessParams['event_id'] ?? IdGenerator::getSnowId());
    }

    public function getEngine(): string
    {
        return $this->engine;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function getBusinessParam(string $key, mixed $default = null): mixed
    {
        return $this->businessParams[$key] ?? $default;
    }

    public function toArray(): array
    {
        return [
            'engine' => $this->engine,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'event_id' => $this->eventId,
            'business_params' => $this->businessParams,
        ];
    }
}
