<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\UserAgentRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\UserAgentModel;
use RuntimeException;

class UserAgentRepository extends AbstractRepository implements UserAgentRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function __construct(
        protected UserAgentModel $userAgentModel
    ) {
    }

    public function save(SuperMagicAgentDataIsolation $dataIsolation, UserAgentEntity $entity): UserAgentEntity
    {
        $attributes = $this->getAttributes($entity);

        if ($entity->getId()) {
            $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
            /** @var null|UserAgentModel $model */
            $model = $builder->where('id', $entity->getId())->first();
            if (! $model) {
                throw new RuntimeException('User agent not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toUserAgentEntity($model->toArray());
        }

        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
        /** @var null|UserAgentModel $model */
        $model = $builder
            ->where('user_id', $entity->getUserId())
            ->where('agent_code', $entity->getAgentCode())
            ->first();

        if ($model) {
            $model->fill($attributes);
            $model->save();
            return $this->toUserAgentEntity($model->toArray());
        }

        $attributes['id'] = IdGenerator::getSnowId();
        $entity->setId($attributes['id']);
        $this->userAgentModel::query()->create($attributes);

        return $entity;
    }

    public function findByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): ?UserAgentEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
        /** @var null|UserAgentModel $model */
        $model = $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('agent_code', $agentCode)
            ->first();

        return $model ? $this->toUserAgentEntity($model->toArray()) : null;
    }

    public function findByAgentCodes(SuperMagicAgentDataIsolation $dataIsolation, array $agentCodes): array
    {
        if (empty($agentCodes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
        $models = $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->whereIn('agent_code', $agentCodes)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toUserAgentEntity($model->toArray());
            $result[$entity->getAgentCode()] = $entity;
        }

        return $result;
    }

    public function findAgentCodesBySourceTypes(SuperMagicAgentDataIsolation $dataIsolation, array $sourceTypes): array
    {
        $sourceTypes = array_values(array_unique(array_filter($sourceTypes)));
        if ($sourceTypes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());

        return $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->whereIn('source_type', $sourceTypes)
            ->pluck('agent_code')
            ->unique()
            ->values()
            ->toArray();
    }

    public function findByAgentVersionIds(SuperMagicAgentDataIsolation $dataIsolation, array $agentVersionIds): array
    {
        $agentVersionIds = array_values(array_unique(array_filter($agentVersionIds)));
        if ($agentVersionIds === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
        $models = $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->whereIn('agent_version_id', $agentVersionIds)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toUserAgentEntity($model->toArray());
            $agentVersionId = $entity->getAgentVersionId();
            if ($agentVersionId !== null) {
                $result[$agentVersionId] = $entity;
            }
        }

        return $result;
    }

    public function findAllByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
        $models = $builder
            ->where('agent_code', $agentCode)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = $this->toUserAgentEntity($model->toArray());
        }

        return $result;
    }

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());
        return $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('agent_code', $agentCode)
            ->delete() > 0;
    }

    public function deleteByAgentCodeExceptUser(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, string $excludedUserId): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());

        return $builder
            ->where('agent_code', $agentCode)
            ->where('user_id', '!=', $excludedUserId)
            ->delete();
    }

    public function deleteAllByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->userAgentModel::query());

        return $builder
            ->where('agent_code', $agentCode)
            ->delete();
    }

    private function toUserAgentEntity(array $data): UserAgentEntity
    {
        return new UserAgentEntity([
            'id' => $data['id'] ?? null,
            'organization_code' => $data['organization_code'] ?? '',
            'user_id' => $data['user_id'] ?? '',
            'agent_code' => $data['agent_code'] ?? '',
            'agent_version_id' => $data['agent_version_id'] ?? null,
            'source_type' => $data['source_type'] ?? AgentSourceType::LOCAL_CREATE->value,
            'source_id' => $data['source_id'] ?? null,
            'created_at' => isset($data['created_at']) ? (string) $data['created_at'] : null,
            'updated_at' => isset($data['updated_at']) ? (string) $data['updated_at'] : null,
        ]);
    }
}
