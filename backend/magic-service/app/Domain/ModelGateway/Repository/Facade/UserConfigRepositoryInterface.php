<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Facade;

use App\Domain\ModelGateway\Entity\UserConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;

interface UserConfigRepositoryInterface
{
    public function getByAppCodeAndOrganizationCode(LLMDataIsolation $dataIsolation, string $appCode, string $organizationCode, string $userId): ?UserConfigEntity;

    public function create(LLMDataIsolation $dataIsolation, UserConfigEntity $userConfigEntity): UserConfigEntity;

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, UserConfigEntity $userConfigEntity, float $amount): void;
}
