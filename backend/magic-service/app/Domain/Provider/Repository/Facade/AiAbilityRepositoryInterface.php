<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

/**
 * AI 能力仓储接口.
 */
interface AiAbilityRepositoryInterface
{
    /**
     * 根据能力代码获取AI能力实体.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param AiAbilityCode $code 能力代码
     * @return null|AiAbilityEntity AI能力实体
     */
    public function getByCode(MagicUserAuthorization $authorization, AiAbilityCode $code): ?AiAbilityEntity;

    /**
     * 获取所有AI能力列表.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @return array<AiAbilityEntity> AI能力实体列表
     */
    public function getAll(MagicUserAuthorization $authorization): array;

    /**
     * 根据ID获取AI能力实体.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param int $id 能力ID
     * @return null|AiAbilityEntity AI能力实体
     */
    public function getById(MagicUserAuthorization $authorization, int $id): ?AiAbilityEntity;

    /**
     * 保存AI能力实体.
     *
     * @param AiAbilityEntity $entity AI能力实体
     * @return bool 是否保存成功
     */
    public function save(AiAbilityEntity $entity): bool;

    /**
     * 更新AI能力实体.
     *
     * @param AiAbilityEntity $entity AI能力实体
     * @return bool 是否更新成功
     */
    public function update(AiAbilityEntity $entity): bool;

    /**
     * 根据code更新（支持选择性更新）.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param AiAbilityCode $code 能力代码
     * @param array $data 更新数据（status、config等）
     * @return bool 是否更新成功
     */
    public function updateByCode(MagicUserAuthorization $authorization, AiAbilityCode $code, array $data): bool;
}
