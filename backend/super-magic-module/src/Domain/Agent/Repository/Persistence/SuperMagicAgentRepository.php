<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Factory\SuperMagicAgentFactory;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;

class SuperMagicAgentRepository extends SuperMagicAbstractRepository implements SuperMagicAgentRepositoryInterface
{
    public function getByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        /** @var null|SuperMagicAgentModel $model */
        $model = $builder->where('code', $code)->first();

        if (! $model) {
            return null;
        }

        return SuperMagicAgentFactory::createEntity($model);
    }

    public function getUserAgentByVersionCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        /** @var null|SuperMagicAgentModel $model */
        $model = $builder->where('version_code', $code)->where('creator', $dataIsolation->getCurrentUserId())->first();

        if (! $model) {
            return null;
        }

        return SuperMagicAgentFactory::createEntity($model);
    }

    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        if (! is_null($query->getCodes())) {
            if (empty($query->getCodes())) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('code', $query->getCodes());
        }

        if ($query->getCreatorId() !== null) {
            $builder->where('creator', $query->getCreatorId());
        }

        if ($query->getSourceTypes() !== null) {
            if (empty($query->getSourceTypes())) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('source_type', $query->getSourceTypes());
        }

        if ($query->getName()) {
            $builder->where('name', 'like', '%' . $query->getName() . '%');
        }

        if ($query->getEnabled() !== null) {
            $builder->where('enabled', $query->getEnabled());
        }

        // 关键词搜索：在 name_i18n、role_i18n 和 description_i18n JSON 字段中搜索
        if (! empty($query->getKeyword()) && ! empty($query->getLanguageCode())) {
            $keyword = $query->getKeyword();
            $languageCode = $query->getLanguageCode();
            $builder->where(function ($q) use ($keyword, $languageCode) {
                $q->whereRaw(
                    "JSON_EXTRACT(name_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(role_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(description_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                );
            });
        }

        // 排序：pinned_at DESC, updated_at DESC
        // 使用 orderByRaw 处理 NULL 值，将 NULL 排在最后
        $builder->orderByRaw('CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('pinned_at', 'DESC')
            ->orderBy('updated_at', 'DESC');

        $result = $this->getByPage($builder, $page, $query);

        $list = [];

        /** @var SuperMagicAgentModel $model */
        foreach ($result['list'] as $model) {
            $entity = SuperMagicAgentFactory::createEntity($model);
            $list[] = $entity;
        }
        $result['list'] = $list;

        return $result;
    }

    public function save(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $entity): SuperMagicAgentEntity
    {
        if (! $entity->getId()) {
            $model = new SuperMagicAgentModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
            $model = $builder->where('id', $entity->getId())->first();
        }
        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    public function delete(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        return $builder->where('code', $code)->delete() > 0;
    }

    public function countByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): int
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        return $builder->where('creator', $creator)->count();
    }

    public function getCodesByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): array
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        return $builder->where('creator', $creator)->pluck('code')->toArray();
    }

    public function codeExists(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        return $builder->where('code', $code)->exists();
    }

    /**
     * 根据 version_code 列表查询用户已添加的 Agent（用于判断 is_added 和 need_upgrade）.
     *
     * @return array<string, SuperMagicAgentEntity> Agent 实体数组，key 为 version_code
     */
    public function findByVersionCodes(SuperMagicAgentDataIsolation $dataIsolation, string $userId, array $versionCodes): array
    {
        if (empty($versionCodes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        $models = $builder
            ->where('creator', $userId)
            ->whereIn('version_code', $versionCodes)
            ->whereNull('deleted_at')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = SuperMagicAgentFactory::createEntity($model);
            $versionCode = $entity->getVersionCode();
            if ($versionCode !== null) {
                $result[$versionCode] = $entity;
            }
        }

        return $result;
    }

    public function updateUpdatedAtByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code, string $modifier): bool
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        $updated = $builder->where('code', $code)
            ->update([
                'updated_at' => date('Y-m-d H:i:s'),
                'modifier' => $modifier,
            ]);

        return $updated > 0;
    }
}
