<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;

interface MagicAccountRepositoryInterface
{
    // 查询账号信息
    public function getAccountInfoByMagicId(string $magicId): ?AccountEntity;

    /**
     * @return AccountEntity[]
     */
    public function getAccountByMagicIds(array $magicIds): array;

    // 创建账号
    public function createAccount(AccountEntity $accountDTO): AccountEntity;

    /**
     * @param AccountEntity[] $accountDTOs
     * @return AccountEntity[]
     */
    public function createAccounts(array $accountDTOs): array;

    /**
     * @return AccountEntity[]
     */
    public function getAccountInfoByMagicIds(array $magicIds): array;

    public function getAccountInfoByAiCode(string $aiCode): ?AccountEntity;

    /**
     * @return AccountEntity[]
     */
    public function searchUserByPhoneOrRealName(string $query): array;

    public function updateAccount(string $magicId, array $updateData): int;

    public function saveAccount(AccountEntity $accountDTO): AccountEntity;

    /**
     * @return AccountEntity[]
     */
    public function getAccountInfoByAiCodes(array $aiCodes): array;

    public function getByAiCode(string $aiCode): ?AccountEntity;

    /**
     * 通过手机号获取 magic_id.
     */
    public function getMagicIdByPhone(PermissionDataIsolation $dataIsolation, string $phone): ?string;

    /**
     * 通过手机号获取所有 magic_id（一个手机号可能对应多个账号）.
     * @param string $phone 手机号
     * @return string[] magic_id 数组
     */
    public function getMagicIdsByPhone(string $phone): array;
}
