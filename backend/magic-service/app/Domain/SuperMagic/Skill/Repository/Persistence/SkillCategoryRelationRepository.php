<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Persistence;

use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillCategoryRelationType;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Persistence\Model\SkillCategoryRelationModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;

class SkillCategoryRelationRepository implements SkillCategoryRelationRepositoryInterface
{
    public function __construct(private readonly SkillCategoryRelationModel $model)
    {
    }

    public function replaceRelations(string $organizationCode, SkillCategoryRelationType $type, int $relationId, array $categoryIds): void
    {
        $this->model::withTrashed()->where('relation_type', $type->value)->where('relation_id', $relationId)->forceDelete();
        if ($categoryIds === []) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $rows = [];
        foreach ($categoryIds as $categoryId) {
            $rows[] = [
                'id' => IdGenerator::getSnowId(),
                'organization_code' => $organizationCode,
                'relation_type' => $type->value,
                'relation_id' => $relationId,
                'category_id' => $categoryId,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        $this->model::query()->insert($rows);
    }

    public function findCategoryIds(SkillCategoryRelationType $type, int $relationId): array
    {
        return $this->model::query()->where('relation_type', $type->value)->where('relation_id', $relationId)
            ->orderBy('id')->pluck('category_id')->map(static fn ($id) => (int) $id)->all();
    }

    public function findCategoryIdsByRelationIds(SkillCategoryRelationType $type, array $relationIds): array
    {
        $relationIds = array_values(array_unique(array_filter(array_map('intval', $relationIds))));
        if ($relationIds === []) {
            return [];
        }
        $result = [];
        foreach ($this->model::query()->where('relation_type', $type->value)->whereIn('relation_id', $relationIds)->orderBy('id')->get() as $row) {
            $result[(int) $row->relation_id][] = (int) $row->category_id;
        }
        return $result;
    }

    public function deleteByRelationIds(SkillCategoryRelationType $type, array $relationIds): int
    {
        $relationIds = array_values(array_unique(array_filter(array_map('intval', $relationIds))));
        return $relationIds === [] ? 0 : $this->model::query()->where('relation_type', $type->value)->whereIn('relation_id', $relationIds)->delete();
    }

    public function countByCategoryId(SkillCategoryRelationType $type, int $categoryId): int
    {
        return $this->model::query()->where('relation_type', $type->value)->where('category_id', $categoryId)->count();
    }

    public function countMarketRelationsByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array
    {
        $categoryIds = array_values(array_unique(array_filter(array_map('intval', $categoryIds))));
        if ($categoryIds === []) {
            return [];
        }

        /** @var Builder $builder */
        $builder = Db::table('magic_skill_category_relations as relation')
            ->join('magic_skill_market as market', 'market.id', '=', 'relation.relation_id')
            ->select(['relation.category_id'])
            ->selectRaw('COUNT(*) as skill_count')
            ->where('relation.relation_type', SkillCategoryRelationType::SkillMarket->value)
            ->whereIn('relation.category_id', $categoryIds)
            ->whereNull('relation.deleted_at')
            ->whereNull('market.deleted_at')
            ->groupBy('relation.category_id');

        if ($publishedOnly) {
            $builder->where('market.publish_status', PublishStatus::PUBLISHED->value);
        }
        if ($visibleOnly) {
            $builder->where('market.is_hidden', false);
        }

        $counts = [];
        $skillResult = $builder->get()->toArray();
        foreach ($skillResult as $row) {
            $categoryId = $row['category_id'];
            $skillCount = $row['skill_count'];
            $counts[(int) $categoryId] = (int) $skillCount;
        }
        return $counts;
    }

    public function findMarketIdsByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array
    {
        $categoryIds = array_values(array_unique(array_filter(array_map('intval', $categoryIds))));
        if ($categoryIds === []) {
            return [];
        }

        $builder = Db::table('magic_skill_category_relations as relation')
            ->join('magic_skill_market as market', 'market.id', '=', 'relation.relation_id')
            ->select(['relation.category_id', 'relation.relation_id'])
            ->where('relation.relation_type', SkillCategoryRelationType::SkillMarket->value)
            ->whereIn('relation.category_id', $categoryIds)
            ->whereNull('relation.deleted_at')
            ->whereNull('market.deleted_at');

        if ($publishedOnly) {
            $builder->where('market.publish_status', PublishStatus::PUBLISHED->value);
        }
        if ($visibleOnly) {
            $builder->where('market.is_hidden', false);
        }

        $result = [];
        $skillResult = $builder->get()->toArray();
        foreach ($skillResult as $row) {
            $categoryId = $row['category_id'];
            $relationId = $row['relation_id'];
            $result[(int) $categoryId][] = (int) $relationId;
        }
        foreach ($result as $categoryId => $marketIds) {
            $result[$categoryId] = array_values(array_unique($marketIds));
        }
        return $result;
    }
}
