<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\UserSkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\UserSkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\UserSkillModel;
use RuntimeException;

class UserSkillRepository extends AbstractRepository implements UserSkillRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function __construct(
        protected UserSkillModel $userSkillModel
    ) {
    }

    public function save(SkillDataIsolation $dataIsolation, UserSkillEntity $entity): UserSkillEntity
    {
        $attributes = $this->getAttributes($entity);

        if ($entity->getId()) {
            $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());
            /** @var null|UserSkillModel $model */
            $model = $builder->where('id', $entity->getId())->first();
            if (! $model) {
                throw new RuntimeException('User skill not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toUserSkillEntity($model->toArray());
        }

        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());
        /** @var null|UserSkillModel $model */
        $model = $builder
            ->where('user_id', $entity->getUserId())
            ->where('skill_code', $entity->getSkillCode())
            ->first();

        if ($model) {
            $model->fill($attributes);
            $model->save();
            return $this->toUserSkillEntity($model->toArray());
        }

        $attributes['id'] = IdGenerator::getSnowId();
        $entity->setId($attributes['id']);
        $this->userSkillModel::query()->create($attributes);

        return $entity;
    }

    public function findBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): ?UserSkillEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());
        /** @var null|UserSkillModel $model */
        $model = $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('skill_code', $skillCode)
            ->first();

        return $model ? $this->toUserSkillEntity($model->toArray()) : null;
    }

    public function findCurrentUserSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());

        return $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->pluck('skill_code')
            ->map(static fn ($skillCode) => (string) $skillCode)
            ->all();
    }

    public function findBySkillCodes(SkillDataIsolation $dataIsolation, array $skillCodes): array
    {
        if (empty($skillCodes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());
        $models = $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->whereIn('skill_code', $skillCodes)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toUserSkillEntity($model->toArray());
            $result[$entity->getSkillCode()] = $entity;
        }

        return $result;
    }

    public function findAllBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());
        $models = $builder
            ->where('skill_code', $skillCode)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = $this->toUserSkillEntity($model->toArray());
        }

        return $result;
    }

    public function findSkillCodesBySourceType(
        SkillDataIsolation $dataIsolation,
        SkillSourceType|string $sourceType
    ): array {
        $sourceTypeValue = $sourceType instanceof SkillSourceType ? $sourceType->value : $sourceType;

        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());

        return $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('source_type', $sourceTypeValue)
            ->pluck('skill_code')
            ->map(static fn ($skillCode) => (string) $skillCode)
            ->all();
    }

    public function deleteBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());
        return $builder
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('skill_code', $skillCode)
            ->delete() > 0;
    }

    public function deleteBySkillCodeExceptUser(SkillDataIsolation $dataIsolation, string $skillCode, string $excludedUserId): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());

        return $builder
            ->where('skill_code', $skillCode)
            ->where('user_id', '!=', $excludedUserId)
            ->delete();
    }

    public function deleteAllBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->userSkillModel::query());

        return $builder
            ->where('skill_code', $skillCode)
            ->delete();
    }

    private function toUserSkillEntity(array $data): UserSkillEntity
    {
        return new UserSkillEntity([
            'id' => $data['id'] ?? null,
            'organization_code' => $data['organization_code'] ?? '',
            'user_id' => $data['user_id'] ?? '',
            'skill_code' => $data['skill_code'] ?? '',
            'skill_version_id' => $data['skill_version_id'] ?? null,
            'source_type' => $data['source_type'] ?? SkillSourceType::LOCAL_UPLOAD->value,
            'source_id' => $data['source_id'] ?? null,
            'created_at' => isset($data['created_at']) ? (string) $data['created_at'] : null,
            'updated_at' => isset($data['updated_at']) ? (string) $data['updated_at'] : null,
        ]);
    }
}
