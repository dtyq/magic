<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Contact\Entity\MagicUserIdRelationEntity;
use App\Domain\Contact\Repository\Facade\MagicUserIdRelationRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\UserIdRelationModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

readonly class MagicUserIdRelationRepository implements MagicUserIdRelationRepositoryInterface
{
    public function __construct(
        protected UserIdRelationModel $userIdRelationModel,
    ) {
    }

    public function createUserIdRelation(MagicUserIdRelationEntity $userIdRelationEntity): void
    {
        // 生成关联关系
        $time = date('Y-m-d H:i:s');
        $id = IdGenerator::getSnowId();
        $userIdRelationEntity->setId($id);
        $this->userIdRelationModel::query()->create([
            'id' => $id,
            'magic_id' => $userIdRelationEntity->getAccountId(),
            'id_type' => $userIdRelationEntity->getIdType()->value,
            'id_value' => $userIdRelationEntity->getIdValue(),
            'relation_type' => $userIdRelationEntity->getRelationType(),
            'relation_value' => $userIdRelationEntity->getRelationValue(),
            'created_at' => $time,
            'updated_at' => $time,
        ]);
    }

    public function getRelationIdExists(MagicUserIdRelationEntity $userIdRelationEntity): array
    {
        // 根据 account_id/id_type/relation_value 查询是否已经生成了关联关系
        $userIdRelationModel = $this->userIdRelationModel::query()
            ->where('magic_id', $userIdRelationEntity->getAccountId())
            ->where('relation_type', $userIdRelationEntity->getRelationType())
            ->where('relation_value', $userIdRelationEntity->getRelationValue())
            ->where('id_type', $userIdRelationEntity->getIdType()->value);
        $relation = Db::select($userIdRelationModel->toSql(), $userIdRelationModel->getBindings())[0] ?? null;
        return is_array($relation) ? $relation : [];
    }

    // id_type,relation_type,relation_value 查询 user_id,然后去查询用户信息
    public function getUerIdByRelation(MagicUserIdRelationEntity $userIdRelationEntity): string
    {
        $query = $this->userIdRelationModel::query()
            ->where('relation_type', $userIdRelationEntity->getRelationType())
            ->where('relation_value', $userIdRelationEntity->getRelationValue())
            ->where('id_type', $userIdRelationEntity->getIdType()->value);
        $userIdRelation = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if (empty($userIdRelation)) {
            return '';
        }
        $idValue = $userIdRelation['id_value'] ?? '';
        $userIdRelationEntity->setIdValue($idValue);
        return $idValue;
    }
}
