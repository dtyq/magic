<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Facade;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;

interface EnvironmentRepositoryInterface
{
    public function getEnvById(string $id): ?MagicEnvironmentEntity;

    /**
     * @return MagicEnvironmentEntity[]
     */
    public function getMagicEnvironments(): array;

    /**
     * @return MagicEnvironmentEntity[]
     */
    public function getMagicEnvironmentsByIds(array $ids): array;

    public function getMagicEnvironmentById(int $envId): ?MagicEnvironmentEntity;

    public function createMagicEnvironment(MagicEnvironmentEntity $environmentDTO): MagicEnvironmentEntity;

    public function updateMagicEnvironment(MagicEnvironmentEntity $environmentDTO): MagicEnvironmentEntity;

    public function getEnvironmentEntityByLoginCode(string $loginCode): ?MagicEnvironmentEntity;
}
