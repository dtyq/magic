<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Repository\Persistence;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Domain\Token\Repository\Persistence\Factory\MagicTokenExtraFactory;
use App\Domain\Token\Repository\Persistence\Model\MagicToken;
use App\ErrorCode\TokenErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

class MagicTokenRepository implements MagicTokenRepositoryInterface
{
    private MagicTokenExtraFactory $tokenExtraFactory;

    public function __construct(
        protected MagicToken $token,
        ?MagicTokenExtraFactory $tokenExtraFactory = null
    ) {
        $this->tokenExtraFactory = $tokenExtraFactory ?? new MagicTokenExtraFactory();
    }

    /**
     * 获取 token 关联值.比如 token对应的 magic_id是多少.
     *
     * @deprecated 请使用 queryTokenEntity 代替
     */
    public function getTokenEntity(MagicTokenEntity $tokenDTO): ?MagicTokenEntity
    {
        return $this->queryTokenEntity($tokenDTO->getType(), $tokenDTO->getToken());
    }

    public function queryTokenEntity(MagicTokenType $type, string $token, bool $checkExpired = true): ?MagicTokenEntity
    {
        $query = $this->token::query()
            ->where('type', $type->value)
            ->where('token', $token);

        if ($checkExpired) {
            $query->where('expired_at', '>', date('Y-m-d H:i:s'));
        }

        $query->orderBy('id', 'desc')
            ->limit(1);

        return $this->findValidToken($query);
    }

    public function getTokenEntityByToken(string $token): ?MagicTokenEntity
    {
        $query = $this->token::query()
            ->where('token', $token)
            ->where('expired_at', '>', date('Y-m-d H:i:s'))
            ->orderBy('id', 'desc')
            ->limit(1);

        return $this->findValidToken($query);
    }

    public function createToken(MagicTokenEntity $tokenDTO): void
    {
        if (empty($tokenDTO->getExpiredAt())) {
            ExceptionBuilder::throw(TokenErrorCode::TokenExpiredAtMustSet);
        }
        if (empty($tokenDTO->getTypeRelationValue())) {
            ExceptionBuilder::throw(TokenErrorCode::TokenRelationValueMustSet);
        }
        if (Carbon::parse($tokenDTO->getExpiredAt())->isPast()) {
            ExceptionBuilder::throw(TokenErrorCode::TokenExpired);
        }

        // 先删除同 type+token 的旧记录（包括已过期），避免唯一索引冲突
        $existing = $this->queryTokenEntity($tokenDTO->getType(), $tokenDTO->getToken(), false);
        if ($existing !== null) {
            $this->token::query()->where('id', $existing->getId())->delete();
        }

        $time = date('Y-m-d H:i:s');
        $id = IdGenerator::getSnowId();
        $tokenDTO->setId($id);
        $tokenDTO->setCreatedAt($time);
        $tokenDTO->setUpdatedAt($time);
        $this->token::query()->create([
            'id' => $tokenDTO->getId(),
            'token' => $tokenDTO->getToken(),
            'type' => $tokenDTO->getType(),
            'type_relation_value' => $tokenDTO->getTypeRelationValue(),
            'expired_at' => $tokenDTO->getExpiredAt(),
            'created_at' => $tokenDTO->getCreatedAt(),
            'updated_at' => $tokenDTO->getUpdatedAt(),
            'extra' => Json::encode($tokenDTO->getExtra()?->toArray()),
        ]);
    }

    public function getTokenByTypeAndRelationValue(MagicTokenType $type, string $relationValue): ?MagicTokenEntity
    {
        $query = $this->token::query()
            ->where('type', $type->value)
            ->where('type_relation_value', $relationValue)
            ->where('expired_at', '>', date('Y-m-d H:i:s'))
            ->orderBy('id', 'desc')
            ->limit(1);

        return $this->findValidToken($query);
    }

    /**
     * 按 type + relationValue 列出 token（通常用于同一个业务维度下的 token 收敛/清理）。
     *
     * @param MagicTokenType $type Token 类型
     * @param string $relationValue 关联值（如 user_id、resource_id 等）
     * @param bool $checkExpired 是否检查过期：true=只返回未过期的（有效）; false=返回所有（包含过期）
     * @param int $limit 返回条数限制
     * @return MagicTokenEntity[]
     */
    public function listTokenEntitiesByTypeAndRelationValue(
        MagicTokenType $type,
        string $relationValue,
        bool $checkExpired = true,
        int $limit = 50
    ): array {
        $limit = max(1, min(200, $limit));

        $query = $this->token::query()
            ->where('type', $type->value)
            ->where('type_relation_value', $relationValue);

        if ($checkExpired) {
            $query->where('expired_at', '>', date('Y-m-d H:i:s'));
        }

        // 最新且最久不过期的排在最前面：expired_at desc, id desc
        $query->orderBy('expired_at', 'desc')
            ->orderBy('id', 'desc')
            ->limit($limit);

        $rows = Db::select($query->toSql(), $query->getBindings());
        if (empty($rows)) {
            return [];
        }

        $entities = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            if (empty($row) || empty($row['type_relation_value'])) {
                continue;
            }
            $entities[] = new MagicTokenEntity($row);
        }
        return $entities;
    }

    public function refreshTokenExpiration(MagicTokenEntity $tokenDTO): void
    {
        $updatedAt = $tokenDTO->getUpdatedAt() ?? date('Y-m-d H:i:s');
        $this->token::query()
            ->where('id', $tokenDTO->getId())
            ->update([
                'expired_at' => $tokenDTO->getExpiredAt(),
                'updated_at' => $updatedAt,
            ]);
    }

    public function batchUpdateTokenExpiration(array $ids, string $expiredAt): int
    {
        if (empty($ids)) {
            return 0;
        }
        return $this->token::query()
            ->whereIn('id', $ids)
            ->update([
                'expired_at' => $expiredAt,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function deleteToken(MagicTokenEntity $tokenDTO): void
    {
        $this->token::query()
            ->where('token', $tokenDTO->getToken())
            ->where('type', $tokenDTO->getType())
            ->delete();
    }

    public function deleteExpiredTokens(int $batchSize): int
    {
        $batchSize = max(1, $batchSize);
        $now = date('Y-m-d H:i:s');

        $ids = $this->token::query()
            ->where('expired_at', '<=', $now)
            ->orderBy('id')
            ->limit($batchSize)
            ->pluck('id')
            ->toArray();

        if (empty($ids)) {
            return 0;
        }

        return $this->token::query()
            ->whereIn('id', $ids)
            ->delete();
    }

    private function findValidToken($query): ?MagicTokenEntity
    {
        $token = Db::select($query->toSql(), $query->getBindings())[0] ?? null;

        if (empty($token)) {
            return null;
        }

        if (empty($token['type_relation_value'])) {
            return null;
        }

        $entity = new MagicTokenEntity($token);

        // 通过工厂统一管理 type -> extra 的映射；未配置映射的类型保持原样。
        $typedExtra = $this->tokenExtraFactory->create($entity->getType(), $token['extra'] ?? null);
        if ($typedExtra !== null) {
            $entity->setExtra($typedExtra);
        }

        return $entity;
    }
}
