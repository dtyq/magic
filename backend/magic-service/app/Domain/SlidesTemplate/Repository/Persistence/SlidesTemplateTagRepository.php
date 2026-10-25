<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateTagQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Factory\SlidesTemplateTagFactory;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateTagModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Model\Builder;
use Hyperf\Database\Query\JoinClause;

class SlidesTemplateTagRepository extends AbstractRepository implements SlidesTemplateTagRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    protected string $filterOrganizationCodeAlias = 'magic_slides_template_tags.organization_code';

    public function findById(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateTagEntity
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        /** @var null|SlidesTemplateTagModel $model */
        $model = $builder->where('id', $id)->first();

        return $model ? SlidesTemplateTagFactory::modelToEntity($model) : null;
    }

    public function findByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateTagEntity
    {
        $model = $this->findModelByCode($dataIsolation, $code, false);

        return $model ? SlidesTemplateTagFactory::modelToEntity($model) : null;
    }

    public function findByCodeWithTrashed(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateTagEntity
    {
        $model = $this->findModelByCode($dataIsolation, $code, true);

        return $model ? SlidesTemplateTagFactory::modelToEntity($model) : null;
    }

    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes, ?int $status = null): array
    {
        $codes = array_values(array_unique(array_filter($codes, static fn (string $code): bool => $code !== '')));
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        $builder->whereIn('code', $codes);
        if ($status !== null) {
            $builder->where('status', $status);
        }
        $models = $builder->get();

        return $this->modelsToEntities($models);
    }

    public function queriesWithTemplateCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateTagQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        $this->applyQuery($builder, $query);
        $this->joinEnabledTemplateRelations($builder, $dataIsolation);
        $this->applyTemplateQuery($builder, $query);

        $columns = [
            'magic_slides_template_tags.id',
            'magic_slides_template_tags.organization_code',
            'magic_slides_template_tags.parent_id',
            'magic_slides_template_tags.node_type',
            'magic_slides_template_tags.code',
            'magic_slides_template_tags.name_i18n',
            'magic_slides_template_tags.description_i18n',
            'magic_slides_template_tags.status',
            'magic_slides_template_tags.sort',
            'magic_slides_template_tags.created_uid',
            'magic_slides_template_tags.updated_uid',
            'magic_slides_template_tags.created_at',
            'magic_slides_template_tags.updated_at',
            'magic_slides_template_tags.deleted_at',
        ];

        $builder->select($columns)
            ->selectRaw('COUNT(DISTINCT t.id) AS template_count')
            ->groupBy($columns);

        if ($query->isOnlyWithTemplates()) {
            $builder->havingRaw('COUNT(DISTINCT t.id) > 0');
        }

        $builder->orderBy('magic_slides_template_tags.sort', 'desc')
            ->orderBy('magic_slides_template_tags.id', 'desc');

        $total = -1;
        if ($page->isTotal()) {
            $total = count((clone $builder)->get());
        }

        $list = [];
        if (! $page->isTotal() || $total > 0) {
            $list = $page->isEnabled() ? $builder->forPage($page->getPage(), $page->getPageNum())->get() : $builder->get();
        }

        return [
            'total' => $total,
            'list' => $this->modelsToEntities($list),
        ];
    }

    public function queriesVisibleGroupsWithTagsByCategory(SlidesTemplateDataIsolation $dataIsolation, ?string $categoryCode): array
    {
        $tagModels = $this->queryVisibleTemplateTagsByCategory($dataIsolation, $categoryCode);
        $tags = $this->modelsToEntities($tagModels);
        if ($tags === []) {
            return [];
        }

        $parentIds = array_values(array_unique(array_map(
            static fn (SlidesTemplateTagEntity $tag): int => $tag->getParentId(),
            $tags
        )));

        $groupBuilder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        $groupModels = $groupBuilder
            ->whereIn('id', $parentIds)
            ->where('node_type', 'group')
            ->where('status', SlidesTemplateTagStatus::Enabled->value)
            ->orderBy('sort', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $groups = [];
        foreach ($this->modelsToEntities($groupModels) as $group) {
            $groups[(int) $group->getId()] = $group;
        }

        foreach ($tags as $tag) {
            $group = $groups[$tag->getParentId()] ?? null;
            if ($group === null) {
                continue;
            }

            $children = $group->getChildren();
            $children[] = $tag;
            $group->setChildren($children);
        }

        $groups = array_values(array_filter(
            $groups,
            static fn (SlidesTemplateTagEntity $group): bool => $group->getChildren() !== []
        ));

        return $groups;
    }

    /**
     * @return SlidesTemplateTagEntity[]
     */
    public function queriesTree(SlidesTemplateDataIsolation $dataIsolation): array
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        $models = $builder
            ->whereIn('node_type', ['group', 'tag'])
            ->orderBy('sort', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $groups = [];
        $tags = [];
        foreach ($this->modelsToEntities($models) as $node) {
            if ($node->isGroup()) {
                $groups[(int) $node->getId()] = $node;
                continue;
            }
            if ($node->isTag()) {
                $tags[] = $node;
            }
        }

        foreach ($tags as $tag) {
            $group = $groups[$tag->getParentId()] ?? null;
            if ($group === null) {
                continue;
            }

            $children = $group->getChildren();
            $children[] = $tag;
            $group->setChildren($children);
        }

        return array_values($groups);
    }

    public function existsByParentId(SlidesTemplateDataIsolation $dataIsolation, int $parentId): bool
    {
        return $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query())
            ->where('parent_id', $parentId)
            ->exists();
    }

    public function save(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateTagEntity $entity): SlidesTemplateTagEntity
    {
        if ($entity->getOrganizationCode() === '') {
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        }

        if ($entity->getId() === null) {
            $model = new SlidesTemplateTagModel();
            $model->id = IdGenerator::getSnowId();
        } else {
            /** @var null|SlidesTemplateTagModel $model */
            $model = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::withTrashed())
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                $model = new SlidesTemplateTagModel();
            }
        }

        if ($model->trashed()) {
            $model->restore();
        }
        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return SlidesTemplateTagFactory::modelToEntity($model);
    }

    public function updateStatus(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $status, string $updatedUid): bool
    {
        return $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query())
            ->where('id', $id)
            ->update([
                'status' => $status,
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    public function updateSort(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $sort, string $updatedUid): bool
    {
        return $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query())
            ->where('id', $id)
            ->update([
                'sort' => $sort,
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): bool
    {
        /** @var null|SlidesTemplateTagModel $model */
        $model = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query())
            ->where('id', $id)
            ->first();
        if (! $model) {
            return false;
        }

        return (bool) $model->delete();
    }

    private function applyQuery(Builder $builder, SlidesTemplateTagQuery $query): void
    {
        if ($query->getCode() !== null) {
            $builder->where('magic_slides_template_tags.code', $query->getCode());
        }

        if ($query->getStatus() !== null) {
            $builder->where('magic_slides_template_tags.status', $query->getStatus());
        }

        if ($query->getParentId() !== null) {
            $builder->where('magic_slides_template_tags.parent_id', $query->getParentId());
        }

        if ($query->getNodeType() !== null) {
            $builder->where('magic_slides_template_tags.node_type', $query->getNodeType());
        }

        if ($query->getKeyword() !== null) {
            $keyword = mb_strtolower($query->getKeyword(), 'UTF-8');
            $keywordLike = '%' . addcslashes($keyword, '\%_') . '%';
            $builder->where(static function (Builder $builder) use ($keywordLike): void {
                $builder->where('magic_slides_template_tags.code', 'LIKE', $keywordLike)
                    ->orWhereRaw('LOWER(CAST(magic_slides_template_tags.name_i18n AS CHAR)) LIKE ?', [$keywordLike])
                    ->orWhereRaw('LOWER(CAST(magic_slides_template_tags.description_i18n AS CHAR)) LIKE ?', [$keywordLike]);
            });
        }
    }

    private function joinEnabledTemplateRelations(Builder $builder, SlidesTemplateDataIsolation $dataIsolation): void
    {
        $organizationCodes = array_values(array_filter($dataIsolation->getOfficialOrganizationCodes()));
        $builder->leftJoin('magic_slides_template_tag_relations AS r', static function (JoinClause $join) use ($organizationCodes): void {
            $join->on('r.tag_id', '=', 'magic_slides_template_tags.id')
                ->on('r.organization_code', '=', 'magic_slides_template_tags.organization_code');
            if ($organizationCodes !== []) {
                $join->whereIn('r.organization_code', $organizationCodes);
            }
        });
        $builder->leftJoin('magic_slides_templates AS t', static function (JoinClause $join) use ($organizationCodes): void {
            $join->on('t.id', '=', 'r.template_id')
                ->on('t.organization_code', '=', 'r.organization_code')
                ->on('t.owner_id', '=', 't.organization_code')
                ->where('t.owner_type', '=', SlidesTemplateOwnerType::Official->value)
                ->where('t.status', '=', SlidesTemplateStatus::Enabled->value)
                ->whereNull('t.deleted_at');

            if ($organizationCodes !== []) {
                $join->whereIn('t.organization_code', $organizationCodes);
            }
        });
    }

    private function queryVisibleTemplateTagsByCategory(SlidesTemplateDataIsolation $dataIsolation, ?string $categoryCode): iterable
    {
        $organizationCodes = array_values(array_filter($dataIsolation->getOfficialOrganizationCodes()));
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        $builder->select('magic_slides_template_tags.*')
            ->where('magic_slides_template_tags.node_type', 'tag')
            ->where('magic_slides_template_tags.status', SlidesTemplateTagStatus::Enabled->value)
            ->whereExists(static function ($existsQuery) use ($organizationCodes, $categoryCode): void {
                $existsQuery->selectRaw('1')
                    ->from('magic_slides_template_tag_relations AS r')
                    ->join('magic_slides_templates AS t', static function (JoinClause $join) use ($organizationCodes): void {
                        $join->on('t.id', '=', 'r.template_id')
                            ->on('t.organization_code', '=', 'r.organization_code')
                            ->on('t.owner_id', '=', 't.organization_code')
                            ->where('t.owner_type', '=', SlidesTemplateOwnerType::Official->value)
                            ->where('t.status', '=', SlidesTemplateStatus::Enabled->value)
                            ->whereNull('t.deleted_at');

                        if ($organizationCodes !== []) {
                            $join->whereIn('t.organization_code', $organizationCodes);
                        }
                    })
                    ->whereColumn('r.tag_id', 'magic_slides_template_tags.id')
                    ->whereColumn('r.organization_code', 'magic_slides_template_tags.organization_code');

                if ($organizationCodes !== []) {
                    $existsQuery->whereIn('r.organization_code', $organizationCodes);
                }

                if ($categoryCode !== null && $categoryCode !== '') {
                    $existsQuery->where('t.category_code', $categoryCode);
                }
            })
            ->orderBy('magic_slides_template_tags.sort', 'desc')
            ->orderBy('magic_slides_template_tags.id', 'desc');

        return $builder->get();
    }

    private function applyTemplateQuery(Builder $builder, SlidesTemplateTagQuery $query): void
    {
        if ($query->getTemplateCategoryCode() !== null) {
            $builder->where('t.category_code', $query->getTemplateCategoryCode());
        }

        if ($query->getTemplateKeyword() !== null) {
            $keyword = mb_strtolower($query->getTemplateKeyword(), 'UTF-8');
            $keywordLike = '%' . addcslashes($keyword, '\%_') . '%';
            $builder->where('t.search_text', 'LIKE', $keywordLike);
        }

        $tagCodes = $query->getTemplateTagCodes();
        if ($tagCodes === []) {
            return;
        }

        if ($query->getTemplateTagMatch() === SlidesTemplateTagMatch::All) {
            foreach ($tagCodes as $tagCode) {
                $this->whereJoinedTemplateHasEnabledTag($builder, [$tagCode]);
            }
            return;
        }

        $this->whereJoinedTemplateHasEnabledTag($builder, $tagCodes);
    }

    private function whereJoinedTemplateHasEnabledTag(Builder $builder, array $tagCodes): void
    {
        $builder->whereExists(static function ($subQuery) use ($tagCodes): void {
            $subQuery->selectRaw('1')
                ->from('magic_slides_template_tag_relations AS tr_filter')
                ->join('magic_slides_template_tags AS tag_filter', 'tag_filter.id', '=', 'tr_filter.tag_id')
                ->whereColumn('tr_filter.template_id', 't.id')
                ->whereColumn('tr_filter.organization_code', 't.organization_code')
                ->whereIn('tag_filter.code', $tagCodes)
                ->where('tag_filter.node_type', 'tag')
                ->where('tag_filter.status', SlidesTemplateTagStatus::Enabled->value)
                ->whereNull('tag_filter.deleted_at');
        });
    }

    private function modelsToEntities(iterable $models): array
    {
        $list = [];
        foreach ($models as $model) {
            /* @var SlidesTemplateTagModel $model */
            $list[] = SlidesTemplateTagFactory::modelToEntity($model);
        }
        return $list;
    }

    private function findModelByCode(SlidesTemplateDataIsolation $dataIsolation, string $code, bool $withTrashed): ?SlidesTemplateTagModel
    {
        $query = $withTrashed ? SlidesTemplateTagModel::withTrashed() : SlidesTemplateTagModel::query();
        $builder = $this->createBuilder($dataIsolation, $query);
        $model = $builder->where('code', $code)->first();

        return $model instanceof SlidesTemplateTagModel ? $model : null;
    }
}
