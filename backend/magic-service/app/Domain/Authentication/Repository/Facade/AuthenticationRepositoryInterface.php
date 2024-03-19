<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Repository\Facade;

use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;

interface AuthenticationRepositoryInterface
{
    /**
     * 通过邮箱查找账号.
     */
    public function findAccountByEmail(string $email): ?AccountEntity;

    /**
     * 通过手机号查找账号.
     */
    public function findAccountByPhone(string $stateCode, string $phone): ?AccountEntity;

    /**
     * 通过MagicID和组织编码查找用户.
     */
    public function findUserByMagicIdAndOrganization(string $magicId, ?string $organizationCode = null): ?MagicUserEntity;
}
