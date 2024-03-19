<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Chat\Repository\Persistence\MagicContactIdMappingRepository;
use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;

readonly class MagicThirdPlatformDomainService
{
    public function __construct(private MagicContactIdMappingRepository $thirdPlatformRepository)
    {
    }

    /**
     * @return MagicThirdPlatformIdMappingEntity[]
     */
    public function getThirdDepartments(
        array $currentDepartmentIds,
        string $magicOrganizationCode,
        PlatformType $thirdPlatformType
    ): array {
        return $this->thirdPlatformRepository->getThirdDepartments($currentDepartmentIds, $magicOrganizationCode, $thirdPlatformType);
    }
}
