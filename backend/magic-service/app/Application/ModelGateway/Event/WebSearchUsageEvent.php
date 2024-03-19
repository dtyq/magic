<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event;

class WebSearchUsageEvent
{
    public function __construct(
        public string $engine,
        public string $organizationCode,
        public string $userId,
        public array $businessParams = [],
    ) {
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
            'business_params' => $this->businessParams,
        ];
    }
}
