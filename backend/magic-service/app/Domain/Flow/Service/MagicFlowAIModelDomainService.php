<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowAIModelQuery;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowAIModelDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowAIModelRepositoryInterface $magicFlowAIModelRepository
    ) {
    }

    public function getByName(FlowDataIsolation $dataIsolation, string $name): ?MagicFlowAIModelEntity
    {
        return $this->magicFlowAIModelRepository->getByName($dataIsolation, $name);
    }

    /**
     * @return array{total: int, list: array<MagicFlowAIModelEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowAIModelQuery $query, Page $page): array
    {
        return $this->magicFlowAIModelRepository->queries($dataIsolation, $query, $page);
    }
}
