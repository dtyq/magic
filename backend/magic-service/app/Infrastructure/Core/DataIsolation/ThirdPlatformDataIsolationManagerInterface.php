<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;

interface ThirdPlatformDataIsolationManagerInterface
{
    public function extends(DataIsolationInterface $parentDataIsolation): void;

    public function init(DataIsolationInterface $dataIsolation, MagicEnvironmentEntity $magicEnvironmentEntity): void;

    public function toArray(): array;
}
