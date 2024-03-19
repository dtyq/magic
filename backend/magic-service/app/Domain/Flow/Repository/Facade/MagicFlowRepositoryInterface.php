<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowQuery;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowEntity $magicFlowEntity): MagicFlowEntity;

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowEntity;

    /**
     * @return array<MagicFlowEntity>
     */
    public function getByCodes(FlowDataIsolation $dataIsolation, array $codes): array;

    public function getByName(FlowDataIsolation $dataIsolation, string $name, Type $type): ?MagicFlowEntity;

    public function remove(FlowDataIsolation $dataIsolation, MagicFlowEntity $magicFlowEntity): void;

    /**
     * @return array{total: int, list: array<MagicFlowEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowQuery $query, Page $page): array;

    public function changeEnable(FlowDataIsolation $dataIsolation, string $code, bool $enable): void;

    public function getToolsInfo(FlowDataIsolation $dataIsolation, string $toolSetId): array;
}
