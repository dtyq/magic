<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Repository\Implement;

use App\Domain\Authentication\Repository\Facade\AuthenticationRepositoryInterface;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Repository\Persistence\Model\AccountModel;
use App\Domain\Contact\Repository\Persistence\Model\UserModel;
use Hyperf\DbConnection\Db;

class AuthenticationRepository implements AuthenticationRepositoryInterface
{
    private AccountModel $accountModel;

    private UserModel $userModel;

    public function __construct(
        AccountModel $accountModel,
        UserModel $userModel
    ) {
        $this->accountModel = $accountModel;
        $this->userModel = $userModel;
    }

    /**
     * 通过邮箱查找账号.
     */
    public function findAccountByEmail(string $email): ?AccountEntity
    {
        $query = $this->accountModel::getQuery()->where('email', $email)
            ->where('type', 1) // 人类账号
            ->where('status', 0); // 正常状态
        $accountData = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if (! $accountData) {
            return null;
        }

        return new AccountEntity($accountData);
    }

    /**
     * 通过手机号查找账号.
     */
    public function findAccountByPhone(string $stateCode, string $phone): ?AccountEntity
    {
        $query = $this->accountModel::getQuery()
            ->where('country_code', $stateCode)
            ->where('phone', $phone)
            ->where('status', 0) // 正常状态
            ->where('type', 1); // 人类账号

        $accountData = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if (! $accountData) {
            return null;
        }

        return new AccountEntity($accountData);
    }

    /**
     * 通过MagicID和组织编码查找用户.
     */
    public function findUserByMagicIdAndOrganization(string $magicId, ?string $organizationCode = null): ?MagicUserEntity
    {
        $query = $this->userModel::getQuery()->where('magic_id', $magicId)
            ->where('status', 1); // 已激活状态

        if (! empty($organizationCode)) {
            $query->where('organization_code', $organizationCode);
        }

        $userData = Db::select($query->toSql(), $query->getBindings())[0] ?? null;

        if (! $userData) {
            return null;
        }

        return new MagicUserEntity($userData);
    }
}
