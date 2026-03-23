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
use Hyperf\Database\Model\Builder;

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

    public function findByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array
    {
        $codes = array_values(array_unique(array_filter($codes)));
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        $models = $builder
            ->whereIn('code', $codes)
            ->whereNull('deleted_at')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = SuperMagicAgentFactory::createEntity($model);
            $result[$entity->getCode()] = $entity;
        }

        return $result;
    }

    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        $codes = $query->getCodes();
        if ($codes !== null) {
            $codes = array_values(array_unique(array_filter($codes)));
            if ($codes === []) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('code', $codes);
        }

        if ($query->getCreatorId() !== null) {
            $builder->where('creator', $query->getCreatorId());
        }

        $sourceTypes = $query->getSourceTypes();
        if ($sourceTypes !== null) {
            $sourceTypes = array_values(array_unique(array_filter($sourceTypes)));
            if ($sourceTypes === []) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('source_type', $sourceTypes);
        }

        if ($query->getEnabled() !== null) {
            $builder->where('enabled', $query->getEnabled());
        }

        $keyword = trim((string) ($query->getKeyword() ?? ''));
        $languageCode = $query->getLanguageCode() ?? '';
        if ($keyword !== '' && $languageCode !== '') {
            $this->applyKeywordSearch($builder, $keyword, $languageCode);
        }

        $builder->orderByRaw('CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('pinned_at', 'DESC')
            ->orderBy('updated_at', 'DESC');

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = SuperMagicAgentFactory::createEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
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

    public function findByName(string $name, string $organizationCode): ?SuperMagicAgentEntity
    {
        /** @var null|SuperMagicAgentModel $model */
        $model = SuperMagicAgentModel::query()
            ->where('name', $name)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return SuperMagicAgentFactory::createEntity($model);
    }

    /**
     * 在 name_i18n、role_i18n、description_i18n 的指定语言和 default 中搜索关键词.
     */
    protected function applyKeywordSearch(Builder $builder, string $keyword, string $languageCode): void
    {
        $likePattern = '%' . $keyword . '%';
        $conditions = [
            ["JSON_EXTRACT(name_i18n, CONCAT('$.', ?)) LIKE ?", [$languageCode, $likePattern]],
            ["JSON_EXTRACT(name_i18n, '$.default') LIKE ?", [$likePattern]],
            ["JSON_EXTRACT(role_i18n, CONCAT('$.', ?)) LIKE ?", [$languageCode, $likePattern]],
            ["JSON_EXTRACT(role_i18n, '$.default') LIKE ?", [$likePattern]],
            ["JSON_EXTRACT(description_i18n, CONCAT('$.', ?)) LIKE ?", [$languageCode, $likePattern]],
            ["JSON_EXTRACT(description_i18n, '$.default') LIKE ?", [$likePattern]],
        ];

        $builder->where(function ($q) use ($conditions): void {
            foreach ($conditions as $i => [$sql, $bindings]) {
                $i === 0 ? $q->whereRaw($sql, $bindings) : $q->orWhereRaw($sql, $bindings);
            }
        });
    }
}
