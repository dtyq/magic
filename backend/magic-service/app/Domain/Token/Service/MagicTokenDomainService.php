<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Service;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;

class MagicTokenDomainService
{
    public function __construct(
        protected MagicTokenRepositoryInterface $magicTokenRepository,
    ) {
    }

    public function createToken(MagicTokenEntity $tokenEntity): MagicTokenEntity
    {
        $this->magicTokenRepository->createToken($tokenEntity);
        return $tokenEntity;
    }

    public function getAccountId(MagicTokenEntity $tokenEntity): string
    {
        $this->magicTokenRepository->queryTokenEntity($tokenEntity->getType(), $tokenEntity->getToken());
        return $tokenEntity->getTypeRelationValue();
    }

    public function getUserId(MagicTokenEntity $tokenEntity): string
    {
        $this->magicTokenRepository->queryTokenEntity($tokenEntity->getType(), $tokenEntity->getToken());
        return $tokenEntity->getTypeRelationValue();
    }

    public function getTokenByTypeAndRelationValue(MagicTokenType $type, string $relationValue): ?MagicTokenEntity
    {
        return $this->magicTokenRepository->getTokenByTypeAndRelationValue($type, $relationValue);
    }

    public function deleteToken(MagicTokenEntity $tokenEntity): void
    {
        $this->magicTokenRepository->deleteToken($tokenEntity);
    }
}
