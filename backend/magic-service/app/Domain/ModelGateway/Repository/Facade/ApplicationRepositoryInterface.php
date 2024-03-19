<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Facade;

use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ApplicationQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ApplicationRepositoryInterface
{
    public function save(LLMDataIsolation $dataIsolation, ApplicationEntity $LLMApplicationEntity): ApplicationEntity;

    /**
     * @return array{total: int, list: ApplicationEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, ApplicationQuery $query, Page $page): array;

    public function getById(LLMDataIsolation $dataIsolation, int $id): ?ApplicationEntity;

    public function destroy(LLMDataIsolation $dataIsolation, ApplicationEntity $LLMApplicationEntity): void;

    public function getByCode(LLMDataIsolation $dataIsolation, string $code): ?ApplicationEntity;
}
