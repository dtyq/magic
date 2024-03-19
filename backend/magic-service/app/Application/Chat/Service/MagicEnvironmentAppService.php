<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;

class MagicEnvironmentAppService extends AbstractAppService
{
    public function __construct(
        protected MagicOrganizationEnvDomainService $magicOrganizationEnvDomainService,
    ) {
    }

    /**
     * @return MagicEnvironmentEntity[]
     */
    public function getMagicEnvironments(array $ids): array
    {
        if (empty($ids)) {
            return $this->magicOrganizationEnvDomainService->getEnvironmentEntities();
        }
        return $this->magicOrganizationEnvDomainService->getEnvironmentEntitiesByIds($ids);
    }

    // 创建环境
    public function createMagicEnvironment(MagicEnvironmentEntity $environmentDTO): MagicEnvironmentEntity
    {
        return $this->magicOrganizationEnvDomainService->createEnvironment($environmentDTO);
    }

    // 更新环境
    public function updateMagicEnvironment(MagicEnvironmentEntity $environmentDTO): MagicEnvironmentEntity
    {
        return $this->magicOrganizationEnvDomainService->updateEnvironment($environmentDTO);
    }
}
