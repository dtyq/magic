<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

readonly class BusinessParamsDTO
{
    public function __construct(
        public string $organizationCode,
        public string $userId,
        public string $businessId = '',
    ) {
    }

    public function toArray(): array
    {
        return [
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'business_id' => $this->businessId,
        ];
    }
}
