<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Contact\Entity\MagicUserIdRelationEntity;

interface MagicUserIdRelationRepositoryInterface
{
    // 创建
    public function createUserIdRelation(MagicUserIdRelationEntity $userIdRelationEntity): void;

    // 查询
    public function getRelationIdExists(MagicUserIdRelationEntity $userIdRelationEntity): array;

    // id_type,relation_type,relation_value 查询 user_id,然后去查询用户信息
    public function getUerIdByRelation(MagicUserIdRelationEntity $userIdRelationEntity): string;
}
