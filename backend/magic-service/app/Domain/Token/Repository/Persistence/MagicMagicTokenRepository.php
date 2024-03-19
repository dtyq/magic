<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Repository\Persistence;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Domain\Token\Repository\Persistence\Model\MagicToken;
use App\ErrorCode\TokenErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

class MagicMagicTokenRepository implements MagicTokenRepositoryInterface
{
    public function __construct(
        protected MagicToken $token
    ) {
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

        return new MagicTokenEntity($token);
    }
}
