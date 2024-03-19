<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicThirdPlatformDepartmentEntity;
use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;

class DepartmentAssembler
{
    public static function getDepartmentEntity(array $department): MagicDepartmentEntity
    {
        return new MagicDepartmentEntity($department);
    }

    public static function getMagicThirdPlatformIdMappingEntity(array $thirdPlatformIdMapping): MagicThirdPlatformIdMappingEntity
    {
        return new MagicThirdPlatformIdMappingEntity($thirdPlatformIdMapping);
    }

    public static function getThirdPlatformDepartmentEntity(array $thirdPlatformDepartment): MagicThirdPlatformDepartmentEntity
    {
        return new MagicThirdPlatformDepartmentEntity($thirdPlatformDepartment);
    }
}
