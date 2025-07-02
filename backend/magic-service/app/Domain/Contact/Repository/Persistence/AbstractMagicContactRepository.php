<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\AbstractRepository;
use Hyperf\Database\Model\Builder;

class AbstractMagicContactRepository extends AbstractRepository
{
    protected function createContactBuilder(DataIsolation $dataIsolation, Builder $builder): Builder
    {
        if ($this->filterOrganizationCode) {
            $this->addContactIsolationOrganizationCodeFilter($builder, $dataIsolation, $this->filterOrganizationCodeAlias);
        }
        return $builder;
    }

    private function addContactIsolationOrganizationCodeFilter(Builder $builder, DataIsolation $dataIsolation, string $alias = 'organization_code'): void
    {
        if (! $dataIsolation->isEnable()) {
            return;
        }

        $organizationCodes = array_filter([$dataIsolation->getCurrentOrganizationCode()]);
        if (! empty($organizationCodes)) {
            $builder->whereIn($alias, $organizationCodes);
        }
    }
}
