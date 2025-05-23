<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Repository\Facade;

use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use App\Domain\Authentication\Entity\ValueObject\AuthenticationDataIsolation;
use App\Domain\Authentication\Entity\ValueObject\Query\ApiKeyProviderQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ApiKeyProviderRepositoryInterface
{
    public function save(AuthenticationDataIsolation $dataIsolation, ApiKeyProviderEntity $apiKeyProviderEntity): ApiKeyProviderEntity;

    public function getByCode(AuthenticationDataIsolation $dataIsolation, string $code, ?string $operator = null): ?ApiKeyProviderEntity;

    public function getBySecretKey(AuthenticationDataIsolation $dataIsolation, string $secretKey): ?ApiKeyProviderEntity;

    /**
     * @return array{total: int, list: array<ApiKeyProviderEntity>}
     */
    public function queries(AuthenticationDataIsolation $dataIsolation, ApiKeyProviderQuery $query, Page $page): array;

    public function destroy(AuthenticationDataIsolation $dataIsolation, string $code): bool;
}
