<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Infrastructure\Core\AbstractQuery;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\DataIsolation\DataIsolationFilter;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use DateTime;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Collection;
use Hyperf\Database\Query\Builder;

abstract class AbstractProviderModelRepository extends AbstractRepository
{
    use DataIsolationFilter;

    protected bool $filterOrganizationCode = false;

    protected array $attributeMaps = [];

    /**
     * 创建新的模型实体.
     */
    public function create(ProviderDataIsolation $dataIsolation, ProviderModelEntity $modelEntity): ProviderModelEntity
    {
        $modelEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        // 创建新记录
        if ($modelEntity->getId() === null) {
            $modelEntity->setId(IdGenerator::getSnowId());
        }
        // 检查时间字段是否为空
        if ($modelEntity->getCreatedAt() === null || $modelEntity->getUpdatedAt() === null) {
            $modelEntity->setCreatedAt(new DateTime());
            $modelEntity->setUpdatedAt(new DateTime());
            $modelEntity->setDeletedAt(null);
        }
        // 创建新记录
        ProviderModelModel::query()->create($modelEntity->toArray());
        return $modelEntity;
    }

    /**
     * 将实体序列化为数组，包含JSON序列化复杂字段.
     */
    protected function serializeEntityToArray(ProviderModelEntity $entity): array
    {
        $entityArray = $entity->toArray();
        $entityArray['config'] = Json::encode($entity->getConfig() ? $entity->getConfig()->toArray() : []);
        $entityArray['translate'] = Json::encode($entity->getTranslate() ?: []);
        $entityArray['visible_organizations'] = Json::encode($entity->getVisibleOrganizations());
        $entityArray['visible_applications'] = Json::encode($entity->getVisibleApplications());
        $entityArray['visible_packages'] = Json::encode($entity->getVisiblePackages());

        return $entityArray;
    }

    /**
     * @return array{total: int, list: array|Collection}
     */
    protected function getByPage(Builder|\Hyperf\Database\Model\Builder $builder, Page $page, ?AbstractQuery $query = null): array
    {
        if ($query) {
            foreach ($query->getOrder() as $column => $order) {
                $builder->orderBy($column, $order);
            }
            if (! empty($query->getSelect())) {
                $builder->select($query->getSelect());
            }
        }
        if (! $page->isEnabled()) {
            $list = $builder->get();
            /* @phpstan-ignore-next-line */
            return [
                'total' => count($list),
                'list' => $list,
            ];
        }
        $total = -1;
        if ($page->isTotal()) {
            $total = $builder->count();
        }
        $list = [];
        if ($total > 0 || ! $page->isTotal()) {
            $list = $builder->forPage($page->getPage(), $page->getPageNum())->get();
        }
        return [
            'total' => $total,
            'list' => $list,
        ];
    }
}
