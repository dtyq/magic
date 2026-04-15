<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\DTO\Common;

readonly class BusinessParamsDTO
{
    public function __construct(
        public string $organizationCode = '',
        public string $userId = '',
        public string $businessId = '',
    ) {
    }

    public static function fromArray(array $params): self
    {
        return new self(
            organizationCode: (string) ($params['organization_code'] ?? ''),
            userId: (string) ($params['user_id'] ?? ''),
            businessId: (string) ($params['business_id'] ?? ''),
        );
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
