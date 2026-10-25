<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateCategoryQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Factory\SlidesTemplateCategoryFactory;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateCategoryRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateCategoryModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Model\Builder;
use Hyperf\Database\Query\JoinClause;

class SlidesTemplateCategoryRepository extends AbstractRepository implements SlidesTemplateCategoryRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    protected string $filterOrganizationCodeAlias = 'magic_slides_template_categories.organization_code';

    public function findById(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateCategoryEntity
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query());
        /** @var null|SlidesTemplateCategoryModel $model */
        $model = $builder->where('id', $id)->first();

        return $model ? SlidesTemplateCategoryFactory::modelToEntity($model) : null;
    }

    public function findByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateCategoryEntity
    {
        $model = $this->findModelByCode($dataIsolation, $code, false);

        return $model ? SlidesTemplateCategoryFactory::modelToEntity($model) : null;
    }

    public function findByCodeWithTrashed(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateCategoryEntity
    {
        $model = $this->findModelByCode($dataIsolation, $code, true);

        return $model ? SlidesTemplateCategoryFactory::modelToEntity($model) : null;
    }

    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes): array
    {
        $codes = array_values(array_unique(array_filter($codes, static fn (string $code): bool => $code !== '')));
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query());
        $models = $builder->whereIn('code', $codes)->get();

        return $this->modelsToEntities($models);
    }

    public function queries(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateCategoryQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query());
        $this->applyQuery($builder, $query);
        $this->applyOnlyWithTemplatesFilter($builder, $dataIsolation, $query);
        $builder->orderBy('sort', 'desc')->orderBy('id', 'desc');

        $data = $this->getByPage($builder, $page);
        $data['list'] = $this->modelsToEntities($data['list']);
        return $data;
    }

    public function queriesWithTemplateCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateCategoryQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query());
        $this->applyQuery($builder, $query);
        $this->joinEnabledTemplates($builder, $dataIsolation);

        $columns = [
            'magic_slides_template_categories.id',
            'magic_slides_template_categories.organization_code',
            'magic_slides_template_categories.code',
            'magic_slides_template_categories.name_i18n',
            'magic_slides_template_categories.status',
            'magic_slides_template_categories.sort',
            'magic_slides_template_categories.created_uid',
            'magic_slides_template_categories.updated_uid',
            'magic_slides_template_categories.created_at',
            'magic_slides_template_categories.updated_at',
            'magic_slides_template_categories.deleted_at',
        ];

        $builder->select($columns)
            ->selectRaw('COUNT(t.id) AS template_count')
            ->groupBy($columns);

        if ($query->isOnlyWithTemplates()) {
            $builder->havingRaw('COUNT(t.id) > 0');
        }

        $builder->orderBy('magic_slides_template_categories.sort', 'desc')
            ->orderBy('magic_slides_template_categories.id', 'desc');

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

    public function save(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateCategoryEntity $entity): SlidesTemplateCategoryEntity
    {
        if ($entity->getOrganizationCode() === '') {
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        }

        if ($entity->getId() === null) {
            $model = new SlidesTemplateCategoryModel();
            $model->id = IdGenerator::getSnowId();
        } else {
            /** @var null|SlidesTemplateCategoryModel $model */
            $model = $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::withTrashed())
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                $model = new SlidesTemplateCategoryModel();
            }
        }

        if ($model->trashed()) {
            $model->restore();
        }
        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return SlidesTemplateCategoryFactory::modelToEntity($model);
    }

    public function updateStatus(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $status, string $updatedUid): bool
    {
        return $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query())
            ->where('id', $id)
            ->update([
                'status' => $status,
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    public function updateSort(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $sort, string $updatedUid): bool
    {
        return $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query())
            ->where('id', $id)
            ->update([
                'sort' => $sort,
                'updated_uid' => $updatedUid,
            ]) > 0;
    }

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): bool
    {
        /** @var null|SlidesTemplateCategoryModel $model */
        $model = $this->createBuilder($dataIsolation, SlidesTemplateCategoryModel::query())
            ->where('id', $id)
            ->first();
        if (! $model) {
            return false;
        }

        return (bool) $model->delete();
    }

    private function applyQuery(Builder $builder, SlidesTemplateCategoryQuery $query): void
    {
        if ($query->getCode() !== null) {
            $builder->where('magic_slides_template_categories.code', $query->getCode());
        }

        if ($query->getStatus() !== null) {
            $builder->where('magic_slides_template_categories.status', $query->getStatus());
        }

        if ($query->getKeyword() !== null) {
            $keyword = mb_strtolower($query->getKeyword(), 'UTF-8');
            $keywordLike = '%' . addcslashes($keyword, '\%_') . '%';
            $builder->where(static function (Builder $builder) use ($keywordLike): void {
                $builder->where('magic_slides_template_categories.code', 'LIKE', $keywordLike)
                    ->orWhereRaw('LOWER(CAST(magic_slides_template_categories.name_i18n AS CHAR)) LIKE ?', [$keywordLike]);
            });
        }
    }

    private function joinEnabledTemplates(Builder $builder, SlidesTemplateDataIsolation $dataIsolation): void
    {
        $organizationCodes = array_values(array_filter($dataIsolation->getOfficialOrganizationCodes()));
        $builder->leftJoin('magic_slides_templates AS t', static function (JoinClause $join) use ($organizationCodes): void {
            $join->on('t.category_code', '=', 'magic_slides_template_categories.code')
                ->on('t.organization_code', '=', 'magic_slides_template_categories.organization_code')
                ->on('t.owner_id', '=', 't.organization_code')
                ->where('t.owner_type', '=', SlidesTemplateOwnerType::Official->value)
                ->where('t.status', '=', SlidesTemplateStatus::Enabled->value)
                ->whereNull('t.deleted_at');

            if ($organizationCodes !== []) {
                $join->whereIn('t.organization_code', $organizationCodes);
            }
        });
    }

    private function applyOnlyWithTemplatesFilter(
        Builder $builder,
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateCategoryQuery $query
    ): void {
        if (! $query->isOnlyWithTemplates()) {
            return;
        }

        $organizationCodes = array_values(array_filter($dataIsolation->getOfficialOrganizationCodes()));
        $builder->whereExists(static function ($existsQuery) use ($organizationCodes): void {
            $existsQuery->selectRaw('1')
                ->from('magic_slides_templates AS t')
                ->whereColumn('t.category_code', 'magic_slides_template_categories.code')
                ->whereColumn('t.organization_code', 'magic_slides_template_categories.organization_code')
                ->where('t.owner_type', SlidesTemplateOwnerType::Official->value)
                ->whereColumn('t.owner_id', 't.organization_code')
                ->where('t.status', SlidesTemplateStatus::Enabled->value)
                ->whereNull('t.deleted_at');

            if ($organizationCodes !== []) {
                $existsQuery->whereIn('t.organization_code', $organizationCodes);
            }
        });
    }

    private function modelsToEntities(iterable $models): array
    {
        $list = [];
        foreach ($models as $model) {
            /* @var SlidesTemplateCategoryModel $model */
            $list[] = SlidesTemplateCategoryFactory::modelToEntity($model);
        }
        return $list;
    }

    private function findModelByCode(SlidesTemplateDataIsolation $dataIsolation, string $code, bool $withTrashed): ?SlidesTemplateCategoryModel
    {
        $query = $withTrashed ? SlidesTemplateCategoryModel::withTrashed() : SlidesTemplateCategoryModel::query();
        $builder = $this->createBuilder($dataIsolation, $query);
        $model = $builder->where('code', $code)->first();

        return $model instanceof SlidesTemplateCategoryModel ? $model : null;
    }
}
