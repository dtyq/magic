<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

readonly class DataIsolationDTO
{
    public function __construct(
        public string $organizationCode,
        public string $userId,
        public string $thirdPlatformUserId = '',
        public string $thirdPlatformOrganizationCode = '',
    ) {
    }

    public function toArray(): array
    {
        $data = [
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
        ];
        if ($this->thirdPlatformUserId !== '') {
            $data['third_platform_user_id'] = $this->thirdPlatformUserId;
        }
        if ($this->thirdPlatformOrganizationCode !== '') {
            $data['third_platform_organization_code'] = $this->thirdPlatformOrganizationCode;
        }
        return $data;
    }
}
