<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Facade;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Entity\MagicOrganizationEnvEntity;

interface OrganizationsEnvironmentRepositoryInterface
{
    public function getOrganizationEnvironmentByMagicOrganizationCode(string $magicOrganizationCode): ?MagicOrganizationEnvEntity;

    public function getOrganizationEnvironmentByOrganizationCode(string $originOrganizationCode, MagicEnvironmentEntity $magicEnvironmentEntity): ?MagicOrganizationEnvEntity;

    public function createOrganizationEnvironment(MagicOrganizationEnvEntity $magicOrganizationEnvEntity): void;

    /**
     * @param string[] $magicOrganizationCodes
     * @return MagicOrganizationEnvEntity[]
     */
    public function getOrganizationEnvironments(array $magicOrganizationCodes, MagicEnvironmentEntity $magicEnvironmentEntity): array;

    /**
     * 获取所有组织编码
     * @return string[]
     */
    public function getAllOrganizationCodes(): array;

    public function getOrganizationEnvironmentByThirdPartyOrganizationCode(string $thirdPartyOrganizationCode, MagicEnvironmentEntity $magicEnvironmentEntity): ?MagicOrganizationEnvEntity;
}
