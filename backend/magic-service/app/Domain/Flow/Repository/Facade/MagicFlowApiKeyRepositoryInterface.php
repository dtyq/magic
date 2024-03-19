<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowApiKeyEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowApiKeyQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowApiKeyRepositoryInterface
{
    public function getBySecretKey(FlowDataIsolation $dataIsolation, string $secretKey): ?MagicFlowApiKeyEntity;

    public function getByCode(FlowDataIsolation $dataIsolation, string $code, ?string $creator = null): ?MagicFlowApiKeyEntity;

    public function save(FlowDataIsolation $dataIsolation, MagicFlowApiKeyEntity $magicFlowApiKeyEntity): MagicFlowApiKeyEntity;

    public function exist(FlowDataIsolation $dataIsolation, MagicFlowApiKeyEntity $magicFlowApiKeyEntity): bool;

    /**
     * @return array{total: int, list: array<MagicFlowApiKeyEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowApiKeyQuery $query, Page $page): array;

    public function destroy(FlowDataIsolation $dataIsolation, string $code): void;
}
