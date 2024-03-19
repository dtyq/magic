<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Entity\MagicOrganizationEnvEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsEnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Model\MagicOrganizationsEnvironmentModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MagicEnvironmentAssembler;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\DbConnection\Db;

readonly class OrganizationsEnvironmentRepository implements OrganizationsEnvironmentRepositoryInterface
{
    public function __construct(private MagicOrganizationsEnvironmentModel $magicEnvironments)
    {
    }

    public function getOrganizationEnvironmentByMagicOrganizationCode(string $magicOrganizationCode): ?MagicOrganizationEnvEntity
    {
        $magicOrganizationEnvData = $this->getOrganizationEnvironmentByMagicOrganizationCodeArray($magicOrganizationCode);
        if ($magicOrganizationEnvData === null) {
            return null;
        }
        return MagicEnvironmentAssembler::getMagicOrganizationEnvEntity($magicOrganizationEnvData);
    }

    public function getOrganizationEnvironmentByOrganizationCode(string $originOrganizationCode, MagicEnvironmentEntity $magicEnvironmentEntity): ?MagicOrganizationEnvEntity
    {
        $magicOrganizationEnv = $this->magicEnvironments->newQuery()
            ->whereIn('environment_id', $magicEnvironmentEntity->getRelationEnvIds())
            ->where('origin_organization_code', $originOrganizationCode)
            ->first();

        if ($magicOrganizationEnv === null) {
            return null;
        }
        return MagicEnvironmentAssembler::getMagicOrganizationEnvEntity($magicOrganizationEnv->toArray());
    }

    public function createOrganizationEnvironment(MagicOrganizationEnvEntity $magicOrganizationEnvEntity): void
    {
        if (empty($magicOrganizationEnvEntity->getId())) {
            $magicOrganizationEnvEntity->setId((string) IdGenerator::getSnowId());
        }
        $time = date('Y-m-d H:i:s');
        $magicOrganizationEnvEntity->setCreatedAt($time);
        $magicOrganizationEnvEntity->setUpdatedAt($time);
        $this->magicEnvironments->newQuery()->create($magicOrganizationEnvEntity->toArray());
    }

    /**
     * @param string[] $magicOrganizationCodes
     * @return MagicOrganizationEnvEntity[]
     */
    public function getOrganizationEnvironments(array $magicOrganizationCodes, MagicEnvironmentEntity $magicEnvironmentEntity): array
    {
        $magicOrganizationEnvironments = $this->magicEnvironments->newQuery()
            ->whereIn('magic_organization_code', $magicOrganizationCodes)
            ->whereIn('environment_id', $magicEnvironmentEntity->getRelationEnvIds())
            ->get()
            ->toArray();

        if (empty($magicOrganizationEnvironments)) {
            return [];
        }
        $magicOrganizationEnvEntities = [];
        foreach ($magicOrganizationEnvironments as $magicOrganizationEnvironment) {
            $magicOrganizationEnvEntities[] = MagicEnvironmentAssembler::getMagicOrganizationEnvEntity($magicOrganizationEnvironment);
        }
        return $magicOrganizationEnvEntities;
    }

    /**
     * 获取所有组织编码
     * @return string[]
     */
    public function getAllOrganizationCodes(): array
    {
        $query = $this->magicEnvironments->newQuery()->select('magic_organization_code');
        $result = Db::select($query->toSql(), $query->getBindings());
        return array_column($result, 'magic_organization_code');
    }

    public function getOrganizationEnvironmentByThirdPartyOrganizationCode(string $thirdPartyOrganizationCode, MagicEnvironmentEntity $magicEnvironmentEntity): ?MagicOrganizationEnvEntity
    {
        $magicOrganizationEnv = $this->magicEnvironments->newQuery()
            ->whereIn('environment_id', $magicEnvironmentEntity->getRelationEnvIds())
            ->where('origin_organization_code', $thirdPartyOrganizationCode)
            ->first();

        if ($magicOrganizationEnv === null) {
            return null;
        }
        return MagicEnvironmentAssembler::getMagicOrganizationEnvEntity($magicOrganizationEnv->toArray());
    }

    #[Cacheable(prefix: 'magic_organizations_environment', ttl: 60, value: '_#{magicOrganizationCode}')]
    private function getOrganizationEnvironmentByMagicOrganizationCodeArray(string $magicOrganizationCode): ?array
    {
        $magicOrganizationEnv = $this->magicEnvironments->newQuery()
            ->where('magic_organization_code', $magicOrganizationCode)
            ->first();

        if ($magicOrganizationEnv === null) {
            return null;
        }
        return $magicOrganizationEnv->toArray();
    }
}
