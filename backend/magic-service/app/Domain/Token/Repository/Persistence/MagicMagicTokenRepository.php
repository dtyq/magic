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

    public function getTokenEntity(MagicTokenEntity $tokenDTO): ?MagicTokenEntity
    {
        $token = $this->token::query()
            ->where('type', $tokenDTO->getType()->value)
            ->where('token', $tokenDTO->getToken())
            ->orderBy('id', 'desc');
        $token = Db::select($token->toSql(), $token->getBindings())[0] ?? null;
        if (empty($token)) {
            return null;
        }
        // If the token is expired, delete it and return null
        if (!empty($token['expired_at']) && Carbon::parse($token['expired_at'])->isPast()) {
            $this->token::query()
                ->where('token', $token['token'])
                ->where('type', $token['type'])
                ->delete();
            return null;
        }
        if (empty($token['type_relation_value'])) {
            return null;
        }
        return new MagicTokenEntity($token);
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
        $token = $this->token::query()
            ->where('type', $type->value)
            ->where('type_relation_value', $relationValue)
            ->where('expired_at', '>', date('Y-m-d H:i:s'))
            ->orderBy('id', 'desc')
            ->get()
            ->toArray()[0] ?? null;
        if (empty($token)) {
            return null;
        }
        return new MagicTokenEntity($token);
    }

    public function deleteToken(MagicTokenEntity $tokenDTO): void
    {
        $this->token::query()
            ->where('token', $tokenDTO->getToken())
            ->where('type', $tokenDTO->getType())
            ->delete();
    }
}
