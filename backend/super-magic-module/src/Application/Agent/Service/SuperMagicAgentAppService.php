<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Qbhy\HyperfAuth\Authenticatable;

class SuperMagicAgentAppService extends AbstractSuperMagicAppService
{
    public function show(Authenticatable $authorization, string $code): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
    }

    public function queries(Authenticatable $authorization, SuperMagicAgentQuery $query, Page $page): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 目前只能查询自己的，全量查询
        $query->setCreatorId($authorization->getId());
        $page->disable();

        return $this->superMagicAgentDomainService->queries($dataIsolation, $query, $page);
    }

    public function save(Authenticatable $authorization, SuperMagicAgentEntity $entity): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->save($dataIsolation, $entity);
    }

    public function delete(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->delete($dataIsolation, $code);
    }

    public function enable(Authenticatable $authorization, string $code): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->enable($dataIsolation, $code);
    }

    public function disable(Authenticatable $authorization, string $code): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->disable($dataIsolation, $code);
    }
}
