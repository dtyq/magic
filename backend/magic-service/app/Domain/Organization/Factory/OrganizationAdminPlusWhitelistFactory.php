<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Organization\Factory;

use App\Domain\Organization\Entity\OrganizationAdminPlusWhitelistEntity;
use App\Domain\Organization\Repository\Persistence\Model\OrganizationAdminPlusWhitelistModel;
use DateTime;

class OrganizationAdminPlusWhitelistFactory
{
    public static function modelToEntity(OrganizationAdminPlusWhitelistModel $model): OrganizationAdminPlusWhitelistEntity
    {
        $entity = new OrganizationAdminPlusWhitelistEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setEnabled((int) $model->enabled);
        $entity->setCreatedAt($model->created_at ? new DateTime((string) $model->created_at) : null);
        $entity->setUpdatedAt($model->updated_at ? new DateTime((string) $model->updated_at) : null);
        $entity->setDeletedAt($model->deleted_at ? new DateTime((string) $model->deleted_at) : null);
        return $entity;
    }
}
