<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowVersionEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowVersionRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowVersionEntity $magicFlowVersionEntity): MagicFlowVersionEntity;

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowVersionEntity;

    public function getByFlowCodeAndCode(FlowDataIsolation $dataIsolation, string $flowCode, string $code): ?MagicFlowVersionEntity;

    /**
     * @return array{total: int, list: array<MagicFlowVersionEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowVersionQuery $query, Page $page): array;

    public function getLastVersion(FlowDataIsolation $dataIsolation, string $flowCode): ?MagicFlowVersionEntity;

    public function existVersion(FlowDataIsolation $dataIsolation, string $flowCode): bool;

    /**
     * @param array<string> $versionCodes
     * @return array<MagicFlowVersionEntity>
     */
    public function getByCodes(FlowDataIsolation $dataIsolation, array $versionCodes): array;
}
