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
        public string $organizationId = '',
    ) {
    }

    public static function fromArray(array $params): self
    {
        $organizationCode = (string) ($params['organization_code'] ?? '');
        $organizationId = (string) ($params['organization_id'] ?? '');
        if ($organizationCode === '') {
            $organizationCode = $organizationId;
        }
        if ($organizationId === '') {
            $organizationId = $organizationCode;
        }

        return new self(
            organizationCode: $organizationCode,
            userId: (string) ($params['user_id'] ?? ''),
            businessId: (string) ($params['business_id'] ?? ''),
            organizationId: $organizationId,
        );
    }

    public function toArray(): array
    {
        return [
            'organization_code' => $this->organizationCode,
            'organization_id' => $this->organizationId,
            'user_id' => $this->userId,
            'business_id' => $this->businessId,
        ];
    }
}
