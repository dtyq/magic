<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Factory;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Repository\Persistence\Model\UserModel;
use App\Interfaces\Chat\Assembler\UserAssembler;

class ContactUserFactory
{
    public static function createByModel(UserModel $userModel): MagicUserEntity
    {
        $user = $userModel->toArray();
        return UserAssembler::getUserEntity($user);
    }
}
