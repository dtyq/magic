<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserIdType;
use App\Domain\Contact\Entity\ValueObject\UserOption;

interface MagicUserRepositoryInterface
{
    public function getSquareAgentList(): array;

    public function createUser(MagicUserEntity $userDTO): MagicUserEntity;

    /**
     * @param MagicUserEntity[] $userDTOs
     * @return MagicUserEntity[]
     */
    public function createUsers(array $userDTOs): array;

    public function getUserById(string $id): ?MagicUserEntity;

    public function getUserByMagicId(DataIsolation $dataIsolation, string $id): ?MagicUserEntity;

    /**
     * @return MagicUserEntity[]
     */
    public function getUserByIdsAndOrganizations(array $ids, array $organizationCodes = [], array $column = ['*']): array;

    /**
     * @return array<string, MagicUserEntity>
     */
    public function getUserByPageToken(string $pageToken = '', int $pageSize = 50): array;

    /**
     * @return array<string, MagicUserEntity>
     */
    public function getByUserIds(string $organizationCode, array $userIds): array;

    /**
     * 根据 userIdType,生成对应类型的值.
     */
    public function getUserIdByType(UserIdType $userIdType, string $addStr): string;

    /**
     * @return string[]
     */
    public function getUserOrganizations(string $userId): array;

    /**
     * 根据 magicId 获取用户所属的组织列表.
     * @return string[]
     */
    public function getUserOrganizationsByMagicId(string $magicId): array;

    public function getUserByAiCode(string $aiCode): array;

    public function searchByKeyword(string $keyword): array;

    public function insertUser(array $userInfo): void;

    public function getUserByMobile(string $mobile): ?array;

    public function getUserByMobileWithStateCode(string $stateCode, string $mobile): ?array;

    public function getUserByMobilesWithStateCode(string $stateCode, array $mobiles): array;

    public function getUserByMobiles(array $mobiles): array;

    public function updateDataById(string $userId, array $data): int;

    public function deleteUserByIds(array $ids): int;

    public function getUserByAccountAndOrganization(string $accountId, string $organizationCode): ?MagicUserEntity;

    public function getUserByAccountsAndOrganization(array $accountIds, string $organizationCode): array;

    public function getUserByAccountsInMagic(array $accountIds): array;

    public function searchByNickName(string $nickName, string $organizationCode): array;

    public function searchByNickNameInMagic(string $nickName): array;

    public function getUserByIds(array $ids): array;

    public function saveUser(MagicUserEntity $userDTO): MagicUserEntity;

    public function addUserManual(string $userId, string $userManual): void;

    /**
     * @return MagicUserEntity[]
     */
    public function getUsersByMagicIdAndOrganizationCode(array $magicIds, string $organizationCode): array;

    /**
     * @return MagicUserEntity[]
     */
    public function getUserByMagicIds(array $magicIds): array;

    /**
     * @return MagicUserEntity[]
     */
    public function getUserAllUserIds(string $userId): array;

    public function updateUserOptionByIds(array $ids, ?UserOption $userOption = null): int;

    public function getMagicIdsByUserIds(array $userIds): array;
}
