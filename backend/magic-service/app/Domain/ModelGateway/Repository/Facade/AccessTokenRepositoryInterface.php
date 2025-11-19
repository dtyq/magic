<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Facade;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\AccessTokenQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface AccessTokenRepositoryInterface
{
    public function save(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity): AccessTokenEntity;

    public function getById(LLMDataIsolation $dataIsolation, int $id): ?AccessTokenEntity;

    /**
     * @return array{total: int, list: AccessTokenEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, Page $page, AccessTokenQuery $query): array;

    public function getByAccessToken(LLMDataIsolation $dataIsolation, string $accessToken): ?AccessTokenEntity;

    public function getByEncryptedAccessToken(LLMDataIsolation $dataIsolation, string $encryptedAccessToken): ?AccessTokenEntity;

    public function destroy(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity): void;

    public function countByTypeAndRelationId(LLMDataIsolation $dataIsolation, AccessTokenType $type, string $relationId): int;

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity, float $amount): void;

    public function getByName(LLMDataIsolation $dataIsolation, string $name): ?AccessTokenEntity;
}
