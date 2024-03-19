<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Repository\Persistence;

use App\Domain\AppMenu\Entity\AppMenuEntity;
use App\Domain\AppMenu\Entity\ValueObject\AppMenuStatus;
use App\Domain\AppMenu\Factory\AppMenuFactory;
use App\Domain\AppMenu\Repository\Facade\AppMenuRepositoryInterface;
use App\Domain\AppMenu\Repository\Persistence\Model\AppMenuModel;
use App\Infrastructure\Core\ValueObject\Page;
use RuntimeException;

class AppMenuRepository implements AppMenuRepositoryInterface
{
    public function getById(int $id): ?AppMenuEntity
    {
        /** @var null|AppMenuModel $model */
        $model = AppMenuModel::query()->where('id', $id)->first();

        return $model ? AppMenuFactory::createEntity($model) : null;
    }

    public function getByPath(string $appPath): ?AppMenuEntity
    {
        /** @var null|AppMenuModel $model */
        $model = AppMenuModel::query()->where('path', $appPath)->first();

        return $model ? AppMenuFactory::createEntity($model) : null;
    }

    /**
     * @param array{name?: string, display_scope?: int} $filters
     * @return array{total: int, list: array<AppMenuEntity>}
     */
    public function queries(array $filters, Page $page): array
    {
        $builder = AppMenuModel::query();

        if (! empty($filters['name'])) {
            $keyword = '%' . $filters['name'] . '%';
            $builder->where(function ($q) use ($keyword): void {
                $q->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(name_i18n, '$.zh_CN')) LIKE ?", [$keyword])
                    ->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(name_i18n, '$.en_US')) LIKE ?", [$keyword]);
            });
        }

        if (array_key_exists('display_scope', $filters) && $filters['display_scope'] !== null) {
            $builder->where('display_scope', $filters['display_scope']);
        }

        $builder->orderBy('sort_order', 'desc')
            ->orderBy('id', 'desc');

        if (! $page->isEnabled()) {
            /** @var array<AppMenuModel> $models */
            $models = $builder->get()->all();

            return [
                'total' => count($models),
                'list' => $this->modelsToEntities($models),
            ];
        }

        $total = $page->isTotal() ? $builder->count() : -1;
        $models = [];
        if (! $page->isTotal() || $total > 0) {
            /** @var array<AppMenuModel> $models */
            $models = $builder->forPage($page->getPage(), $page->getPageNum())->get()->all();
        }

        return [
            'total' => $total,
            'list' => $this->modelsToEntities($models),
        ];
    }

    public function save(AppMenuEntity $entity): AppMenuEntity
    {
        if (! $entity->getId()) {
            $model = new AppMenuModel();
        } else {
            /** @var null|AppMenuModel $model */
            $model = AppMenuModel::query()->where('id', $entity->getId())->first();
            if (! $model) {
                throw new RuntimeException('App menu not found.');
            }
        }

        $model->fill($this->entityToAttributes($entity));
        $model->save();

        $entity->setId($model->id);

        return $entity;
    }

    public function delete(int $id): bool
    {
        $model = AppMenuModel::query()->where('id', $id)->first();
        if ($model === null) {
            return false;
        }
        $model->forceDelete();
        return true;
    }

    /**
     * @param array<int> $displayScopes
     * @return array<AppMenuEntity>
     */
    public function getAllEnabled(array $displayScopes): array
    {
        if ($displayScopes === []) {
            return [];
        }

        /** @var array<AppMenuModel> $models */
        $models = AppMenuModel::query()
            ->where('status', AppMenuStatus::Enabled->value)
            ->whereIn('display_scope', $displayScopes)
            ->orderBy('sort_order', 'desc')
            ->orderBy('id', 'desc')
            ->get()
            ->all();

        return $this->modelsToEntities($models);
    }

    private function modelsToEntities(array $models): array
    {
        $entities = [];

        foreach ($models as $model) {
            $entities[] = AppMenuFactory::createEntity($model);
        }

        return $entities;
    }

    /**
     * @return array<string, mixed>
     */
    private function entityToAttributes(AppMenuEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'name_i18n' => $entity->getNameI18n(),
            'icon' => $entity->getIcon(),
            'icon_url' => $entity->getIconUrl(),
            'icon_type' => $entity->getIconType(),
            'path' => $entity->getPath(),
            'open_method' => $entity->getOpenMethod(),
            'sort_order' => $entity->getSortOrder(),
            'display_scope' => $entity->getDisplayScope(),
            'status' => $entity->getStatus(),
            'creator_id' => $entity->getCreatorId(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }
}
