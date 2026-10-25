<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Factory\SlidesTemplateFactory;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

class SlidesTemplateRepository extends AbstractRepository implements SlidesTemplateRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function findById(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateEntity
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        /** @var null|SlidesTemplateModel $model */
        $model = $builder->where('id', $id)->first();

        return $model ? SlidesTemplateFactory::modelToEntity($model) : null;
    }

    public function findByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity
    {
        $model = $this->findModelByCode($dataIsolation, $code, false);

        return $model ? SlidesTemplateFactory::modelToEntity($model) : null;
    }

    public function findByCodeWithTrashed(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity
    {
        $model = $this->findModelByCode($dataIsolation, $code, true);

        return $model ? SlidesTemplateFactory::modelToEntity($model) : null;
    }

    public function findGloballyByCodeWithTrashed(string $code): ?SlidesTemplateEntity
    {
        /** @var null|SlidesTemplateModel $model */
        $model = SlidesTemplateModel::withTrashed()->where('code', $code)->first();
        return $model ? SlidesTemplateFactory::modelToEntity($model) : null;
    }

    public function findOfficialByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        /** @var null|SlidesTemplateModel $model */
        $model = $builder->where('code', $code)->first();
        return $model ? SlidesTemplateFactory::modelToEntity($model) : null;
    }

    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes): array
    {
        $codes = array_values(array_unique(array_filter($codes, static fn (string $code): bool => $code !== '')));
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        $builder->whereIn('code', $codes);

        /** @var array<int, SlidesTemplateModel> $models */
        $models = $builder->get()->all();
        return array_map(
            static fn (SlidesTemplateModel $model): SlidesTemplateEntity => SlidesTemplateFactory::modelToEntity($model),
            $models
        );
    }

    /** Load vector-hit IDs while preserving Qdrant similarity order. */
    public function findByIds(SlidesTemplateDataIsolation $dataIsolation, array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('strval', $ids))));
        if ($ids === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        /** @var array<int, SlidesTemplateModel> $models */
        $models = $builder->whereIn('id', $ids)->get()->all();
        $map = [];
        foreach ($models as $model) {
            $map[(string) $model->id] = SlidesTemplateFactory::modelToEntity($model);
        }

        $result = [];
        foreach ($ids as $id) {
            if (isset($map[$id])) {
                $result[] = $map[$id];
            }
        }
        return $result;
    }

    /** Load vector-hit IDs using MySQL as the authoritative visibility source. */
    public function findVisibleByIds(
        SlidesTemplateDataIsolation $dataIsolation,
        array $ids,
    ): array {
        $ids = array_values(array_unique(array_filter(array_map('strval', $ids))));
        if ($ids === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query())
            ->whereIn('id', $ids)
            // MySQL is the final authority: semantic results must be enabled.
            ->where('status', SlidesTemplateStatus::Enabled->value);
        /** @var array<int, SlidesTemplateModel> $models */
        $models = $builder->get()->all();
        $map = [];
        foreach ($models as $model) {
            $map[(string) $model->id] = SlidesTemplateFactory::modelToEntity($model);
        }

        $result = [];
        foreach ($ids as $id) {
            if (isset($map[$id])) {
                $result[] = $map[$id];
            }
        }
        return $result;
    }

    /** Read one organization-scoped ID batch for asynchronous full synchronization. */
    public function findIdsForSync(
        SlidesTemplateDataIsolation $dataIsolation,
        string $organizationCode,
        array $templateIds,
        ?string $categoryCode,
        array $tagCodes,
        string $tagMatch,
        string $afterId,
        int $limit
    ): array {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query())
            ->where('organization_code', $organizationCode)
            ->where('owner_type', SlidesTemplateOwnerType::Official->value)
            ->where('status', 1)
            ->where('id', '>', $afterId)
            ->orderBy('id')
            ->limit(max(1, $limit));
        if ($templateIds !== []) {
            $builder->whereIn('id', $templateIds);
        }
        if ($categoryCode !== null) {
            $builder->where('category_code', $categoryCode);
        }
        if ($tagMatch === 'all') {
            foreach ($tagCodes as $tagCode) {
                $this->whereHasEnabledTag($builder, [$tagCode]);
            }
        } elseif ($tagCodes !== []) {
            $this->whereHasEnabledTag($builder, $tagCodes);
        }
        return array_map('strval', $builder->pluck('id')->all());
    }

    /** Keep database search behavior unchanged: search_text filters, sort/id order results. */
    public function queries(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array
    {
        $builder = $this->createQueryBuilder($dataIsolation, $query);
        $builder->orderBy('sort', 'desc')
            ->orderBy('id', 'desc');

        $data = $this->getByPage($builder, $page);
        $list = [];
        foreach ($data['list'] as $model) {
            /* @var SlidesTemplateModel $model */
            $list[] = SlidesTemplateFactory::modelToEntity($model);
        }
        $data['list'] = $list;

        return $data;
    }

    public function queriesFavorites(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array
    {
        $builder = $this->createQueryBuilder($dataIsolation, $query, 'magic_slides_templates.')
            ->join('magic_slides_template_favorites AS favorite', function ($join) use ($dataIsolation): void {
                $join->on('favorite.slide_template_code', '=', 'magic_slides_templates.code')
                    ->where('favorite.organization_code', '=', $dataIsolation->getCurrentOrganizationCode())
                    ->where('favorite.user_id', '=', $dataIsolation->getCurrentUserId());
            })
            ->select('magic_slides_templates.*')
            ->orderBy('favorite.created_at', 'desc')
            ->orderBy('favorite.id', 'desc')
            ->orderBy('magic_slides_templates.code', 'desc');

        $data = $this->getByPage($builder, $page);
        /** @var array<int, SlidesTemplateModel> $models */
        $models = $data['list']->all();
        $data['list'] = array_map(
            static fn (SlidesTemplateModel $model): SlidesTemplateEntity => SlidesTemplateFactory::modelToEntity($model),
            $models
        );
        return $data;
    }

    public function count(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int
    {
        return $this->createQueryBuilder($dataIsolation, $query)->count();
    }

    public function sumTotalUsageCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int
    {
        return (int) $this->createQueryBuilder($dataIsolation, $query)->sum('total_usage_count');
    }

    public function countTodayCreated(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int
    {
        return $this->createQueryBuilder($dataIsolation, $query)
            ->where('status', SlidesTemplateStatus::Enabled->value)
            ->whereDate('created_at', Carbon::today()->toDateString())
            ->count();
    }

    public function save(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): SlidesTemplateEntity
    {
        if ($entity->getOrganizationCode() === '') {
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        }

        if ($entity->getId() === null) {
            $id = IdGenerator::getSnowId();
            $model = new SlidesTemplateModel();
            $model->id = $id;
        } else {
            /** @var null|SlidesTemplateModel $model */
            $model = $this->createBuilder($dataIsolation, SlidesTemplateModel::withTrashed())
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                $model = new SlidesTemplateModel();
            }
        }

        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return SlidesTemplateFactory::modelToEntity($model);
    }

    public function updateStatus(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $status, string $updatedUid): bool
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        return $builder->where('id', $id)
            ->update([
                'status' => $status,
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    public function updateSort(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $sort, string $updatedUid): bool
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        return $builder->where('id', $id)
            ->update([
                'sort' => $sort,
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    public function incrementActualUsageCount(SlidesTemplateDataIsolation $dataIsolation, string $code, int $totalUsageIncrement): bool
    {
        $totalUsageIncrement = max(1, $totalUsageIncrement);

        return $this->createBuilder($dataIsolation, SlidesTemplateModel::query())
            ->where('code', $code)
            ->update([
                'actual_usage_count' => Db::raw('actual_usage_count + 1'),
                'total_usage_count' => Db::raw(sprintf('total_usage_count + %d', $totalUsageIncrement)),
            ]) > 0;
    }

    public function updateBaseUsageCount(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $baseUsageCount, int $totalUsageCount, string $updatedUid): bool
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        return $builder->where('id', $id)
            ->update([
                'base_usage_count' => max(0, $baseUsageCount),
                'total_usage_count' => max(0, $totalUsageCount),
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    /**
     * @return SlidesTemplateEntity[]
     */
    public function findRankedForUsageCount(SlidesTemplateDataIsolation $dataIsolation, int $offset, int $limit): array
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        $models = $builder->orderBy('sort', 'desc')
            ->orderBy('id', 'desc')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $list = [];
        foreach ($models as $model) {
            /* @var SlidesTemplateModel $model */
            $list[] = SlidesTemplateFactory::modelToEntity($model);
        }
        return $list;
    }

    public function countForUsageCount(SlidesTemplateDataIsolation $dataIsolation): int
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        return $builder->count();
    }

    public function updateUsageCounts(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $baseUsageCount, int $totalUsageCount): bool
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        return $builder->where('id', $id)
            ->update([
                'base_usage_count' => max(0, $baseUsageCount),
                'total_usage_count' => max(0, $totalUsageCount),
            ]) > 0;
    }

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): bool
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateModel::query());
        /** @var null|SlidesTemplateModel $model */
        $model = $builder->where('id', $id)->first();

        return $model !== null && (bool) $model->delete();
    }

    private function findModelByCode(SlidesTemplateDataIsolation $dataIsolation, string $code, bool $withTrashed): ?SlidesTemplateModel
    {
        $query = $withTrashed ? SlidesTemplateModel::withTrashed() : SlidesTemplateModel::query();
        $builder = $this->createBuilder($dataIsolation, $query);
        $model = $builder->where('code', $code)->first();

        return $model instanceof SlidesTemplateModel ? $model : null;
    }

    private function createQueryBuilder(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateQuery $query,
        string $columnPrefix = ''
    ): Builder {
        $builder = SlidesTemplateModel::query();
        if ($columnPrefix === '') {
            $builder = $this->createBuilder($dataIsolation, $builder);
        } else {
            $this->addIsolationOrganizationCodeFilter($builder, $dataIsolation, $columnPrefix . 'organization_code');
        }

        if ($query->getCode() !== null) {
            $builder->where($columnPrefix . 'code', $query->getCode());
        }

        if ($query->getCategoryCode() !== null) {
            $builder->where($columnPrefix . 'category_code', $query->getCategoryCode());
        }

        if ($query->getStatus() !== null
            && ($query->getScope() === SlidesTemplateQueryScope::Official || $query->getOwnerType() !== null)) {
            $builder->where($columnPrefix . 'status', $query->getStatus());
        }

        if ($query->getKeyword() !== null) {
            $keyword = mb_strtolower($query->getKeyword(), 'UTF-8');
            $keywordLike = '%' . addcslashes($keyword, '\%_') . '%';
            $builder->where($columnPrefix . 'search_text', 'LIKE', $keywordLike);
        }

        $this->applyOwnershipFilter($builder, $dataIsolation, $query, $columnPrefix);

        $this->applyTagFilter($builder, $query);

        return $builder;
    }

    private function applyOwnershipFilter(
        Builder $builder,
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateQuery $query,
        string $columnPrefix = ''
    ): void {
        if ($query->getOwnerType() !== null) {
            if ($query->getOwnerType()->isOfficial()) {
                $builder->whereIn($columnPrefix . 'organization_code', $dataIsolation->getOfficialOrganizationCodes());
            } else {
                $builder->where($columnPrefix . 'owner_type', $query->getOwnerType()->value);
            }
            if ($query->getOwnerId() !== null) {
                $builder->where($columnPrefix . 'owner_id', $query->getOwnerId());
            }
            return;
        }

        if ($query->getScope() === SlidesTemplateQueryScope::User) {
            self::applyCurrentUserOwnerFilter($builder, $dataIsolation, $columnPrefix);
            return;
        }

        if ($query->getScope() === SlidesTemplateQueryScope::All) {
            $builder->where(static function (Builder $visibilityQuery) use ($dataIsolation, $columnPrefix): void {
                $visibilityQuery->where(static function (Builder $officialQuery) use ($dataIsolation, $columnPrefix): void {
                    $officialQuery->whereIn($columnPrefix . 'organization_code', $dataIsolation->getOfficialOrganizationCodes());
                    $officialQuery->where($columnPrefix . 'status', SlidesTemplateStatus::Enabled->value);
                })
                    ->orWhere(static function (Builder $userQuery) use ($dataIsolation, $columnPrefix): void {
                        self::applyCurrentUserOwnerFilter($userQuery, $dataIsolation, $columnPrefix);
                    });
            });
            return;
        }

        $builder->whereIn($columnPrefix . 'organization_code', $dataIsolation->getOfficialOrganizationCodes());
    }

    private static function applyCurrentUserOwnerFilter(
        Builder $builder,
        SlidesTemplateDataIsolation $dataIsolation,
        string $prefix = ''
    ): void {
        $builder->where($prefix . 'organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->where($prefix . 'owner_type', SlidesTemplateOwnerType::User->value)
            ->where($prefix . 'owner_id', $dataIsolation->getCurrentUserId());
    }

    private function applyTagFilter($builder, SlidesTemplateQuery $query): void
    {
        $tagCodes = $query->getTagCodes();
        if ($tagCodes === []) {
            return;
        }

        if ($query->getTagMatch() === SlidesTemplateTagMatch::All) {
            foreach ($tagCodes as $tagCode) {
                $this->whereHasEnabledTag($builder, [$tagCode]);
            }
            return;
        }

        $this->whereHasEnabledTag($builder, $tagCodes);
    }

    private function whereHasEnabledTag($builder, array $tagCodes): void
    {
        $builder->whereExists(static function ($subQuery) use ($tagCodes): void {
            $subQuery->selectRaw('1')
                ->from('magic_slides_template_tag_relations AS r')
                ->join('magic_slides_template_tags AS tag', 'tag.id', '=', 'r.tag_id')
                ->whereColumn('r.template_id', 'magic_slides_templates.id')
                ->whereColumn('r.organization_code', 'magic_slides_templates.organization_code')
                ->whereIn('tag.code', $tagCodes)
                ->where('tag.node_type', 'tag')
                ->where('tag.status', SlidesTemplateTagStatus::Enabled->value)
                ->whereNull('tag.deleted_at');
        });
    }
}
