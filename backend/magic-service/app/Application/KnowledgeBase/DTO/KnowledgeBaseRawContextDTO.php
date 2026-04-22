<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

readonly class KnowledgeBaseRawContextDTO
{
    public function __construct(
        public string $organizationCode,
        public string $userId,
    ) {
    }

    public static function fromDataIsolation(KnowledgeBaseDataIsolation $dataIsolation): self
    {
        return new self(
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            userId: $dataIsolation->getCurrentUserId(),
        );
    }

    public function dataIsolation(): DataIsolationDTO
    {
        return new DataIsolationDTO(
            organizationCode: $this->organizationCode,
            userId: $this->userId,
        );
    }

    public function businessParams(string $businessId = ''): BusinessParamsDTO
    {
        return new BusinessParamsDTO(
            organizationCode: $this->organizationCode,
            userId: $this->userId,
            businessId: $businessId,
        );
    }

    public function withOrganization(array $payload): array
    {
        $payload['organization_code'] = $this->organizationCode;
        return $payload;
    }

    public function withCreatedUid(array $payload): array
    {
        $payload['created_uid'] = $this->userId;
        return $payload;
    }

    public function withUpdatedUid(array $payload): array
    {
        $payload['updated_uid'] = $this->userId;
        return $payload;
    }
}
