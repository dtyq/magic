<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Facade;

use App\Domain\ModelGateway\Entity\OrganizationConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;

interface OrganizationConfigRepositoryInterface
{
    public function getByAppCodeAndOrganizationCode(LLMDataIsolation $dataIsolation, string $appCode, string $organizationCode): ?OrganizationConfigEntity;

    public function create(LLMDataIsolation $dataIsolation, OrganizationConfigEntity $organizationConfigEntity): OrganizationConfigEntity;

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, OrganizationConfigEntity $organizationConfigEntity, float $amount): void;
}
