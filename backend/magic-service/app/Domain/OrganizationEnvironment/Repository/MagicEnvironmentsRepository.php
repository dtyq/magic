<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\EnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Model\MagicEnvironmentModel;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\Cache\Annotation\CacheEvict;
use Hyperf\Codec\Json;

readonly class MagicEnvironmentsRepository implements EnvironmentRepositoryInterface
{
    public function __construct(private MagicEnvironmentModel $magicEnvironmentModel)
    {
    }

    public function getEnvById(string $id): ?MagicEnvironmentEntity
    {
        $env = $this->getEnvByIdArray($id);
        if (! $env) {
            return null;
        }
        return new MagicEnvironmentEntity($env);
    }

    /**
     * @return MagicEnvironmentEntity[]
     */
    public function getMagicEnvironments(): array
    {
        $entities = [];
        foreach ($this->magicEnvironmentModel->newQuery()->get()->toArray() as $env) {
            $entities[] = new MagicEnvironmentEntity($env);
        }
        return $entities;
    }

    /**
     * @return MagicEnvironmentEntity[]
     */
    public function getMagicEnvironmentsByIds(array $ids): array
    {
        $entities = [];
        $data = $this->magicEnvironmentModel->newQuery()->whereIn('id', $ids)->get()->toArray();
        foreach ($data as $env) {
            $entities[] = new MagicEnvironmentEntity($env);
        }
        return $entities;
    }

    public function getMagicEnvironmentById(int $envId): ?MagicEnvironmentEntity
    {
        $magicOrganizationEnv = $this->magicEnvironmentModel->newQuery()
            ->where('id', $envId)
            ->first()
            ?->toArray();
        if (empty($magicOrganizationEnv)) {
            return null;
        }
        return new MagicEnvironmentEntity($magicOrganizationEnv);
    }

    // 创建环境
    public function createMagicEnvironment(MagicEnvironmentEntity $environmentDTO): MagicEnvironmentEntity
    {
        if (empty($environmentDTO->getId())) {
            $environmentDTO->setId($this->magicEnvironmentModel->newQuery()->max('id') + 1);
        }
        $time = date('Y-m-d H:i:s');
        $environmentDTO->setCreatedAt($time);
        $environmentDTO->setUpdatedAt($time);
        $envData = $environmentDTO->toArray();
        $extra = $environmentDTO->getExtra();
        if ($extra !== null) {
            $envData['extra'] = Json::encode($extra->toArray());
        }
        $this->magicEnvironmentModel->newQuery()->create($envData);
        return $environmentDTO;
    }

    // 更新环境
    #[CacheEvict(prefix: 'magic_environment', value: '_#{environmentDTO.magicId}')]
    public function updateMagicEnvironment(MagicEnvironmentEntity $environmentDTO): MagicEnvironmentEntity
    {
        $time = date('Y-m-d H:i:s');
        $environmentDTO->setUpdatedAt($time);
        $this->magicEnvironmentModel->newQuery()->where('id', $environmentDTO->getId())->update(
            [
                'deployment' => $environmentDTO->getDeployment(),
                'environment' => $environmentDTO->getEnvironment(),
                'environment_code' => $environmentDTO->getEnvironmentCode(),
                'open_platform_config' => Json::encode($environmentDTO->getOpenPlatformConfig()?->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'private_config' => Json::encode($environmentDTO->getPrivateConfig(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'updated_at' => $environmentDTO->getUpdatedAt(),
                'extra' => Json::encode($environmentDTO->getExtra()?->toArray()),
            ]
        );
        return $environmentDTO;
    }

    public function getEnvironmentEntityByLoginCode(string $loginCode): ?MagicEnvironmentEntity
    {
        $magicOrganizationEnv = $this->magicEnvironmentModel->newQuery()
            ->where('environment_code', $loginCode)
            ->first();
        if (empty($magicOrganizationEnv)) {
            return null;
        }
        return new MagicEnvironmentEntity($magicOrganizationEnv->toArray());
    }

    #[Cacheable(prefix: 'magic_environment', value: '_#{id}', ttl: 60)]
    private function getEnvByIdArray(string $id): ?array
    {
        $env = $this->magicEnvironmentModel::query()->find($id)?->toArray();
        if (! $env) {
            return null;
        }
        return $env;
    }
}
