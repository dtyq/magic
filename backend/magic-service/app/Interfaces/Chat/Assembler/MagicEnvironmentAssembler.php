<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\OrganizationEnvironment\Entity\MagicOrganizationEnvEntity;

class MagicEnvironmentAssembler
{
    public static function getMagicOrganizationEnvEntity(array $magicOrganizationEnv): MagicOrganizationEnvEntity
    {
        $magicOrganizationEnvEntity = new MagicOrganizationEnvEntity();
        $magicOrganizationEnvEntity->setId($magicOrganizationEnv['id']);
        $magicOrganizationEnvEntity->setLoginCode($magicOrganizationEnv['login_code']);
        $magicOrganizationEnvEntity->setMagicOrganizationCode($magicOrganizationEnv['magic_organization_code']);
        $magicOrganizationEnvEntity->setOriginOrganizationCode($magicOrganizationEnv['origin_organization_code']);
        $magicOrganizationEnvEntity->setEnvironmentId($magicOrganizationEnv['environment_id']);
        $magicOrganizationEnvEntity->setCreatedAt($magicOrganizationEnv['created_at']);
        $magicOrganizationEnvEntity->setUpdatedAt($magicOrganizationEnv['updated_at']);
        return $magicOrganizationEnvEntity;
    }
}
