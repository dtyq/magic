<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Repository;

use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use App\Domain\Authentication\Entity\ValueObject\AuthenticationDataIsolation;
use App\Domain\Authentication\Entity\ValueObject\Query\ApiKeyProviderQuery;
use App\Domain\Authentication\Factory\ApiKeyProviderFactory;
use App\Domain\Authentication\Repository\Facade\ApiKeyProviderRepositoryInterface;
use App\Domain\Authentication\Repository\Persistence\Model\ApiKeyProviderModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;

class ApiKeyProviderRepository extends AbstractRepository implements ApiKeyProviderRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    protected array $attributeMaps = [
        'creator' => 'created_uid',
        'modifier' => 'updated_uid',
        'rel_type' => 'type',
        'rel_code' => 'flow_code',
    ];

    public function save(AuthenticationDataIsolation $dataIsolation, ApiKeyProviderEntity $apiKeyProviderEntity): ApiKeyProviderEntity
    {
        if ($apiKeyProviderEntity->getId()) {
            $model = $this->createBuilder($dataIsolation, ApiKeyProviderModel::query())
                ->where('id', $apiKeyProviderEntity->getId())
                ->first();
        } else {
            $model = new ApiKeyProviderModel();
        }

        $model->fill($this->getAttributes($apiKeyProviderEntity));
        $model->save();

        $apiKeyProviderEntity->setId($model->id);
        return $apiKeyProviderEntity;
    }

    public function getByCode(AuthenticationDataIsolation $dataIsolation, string $code, ?string $operator = null): ?ApiKeyProviderEntity
    {
        $builder = $this->createBuilder($dataIsolation, ApiKeyProviderModel::query());
        $builder->where('code', $code);

        if ($operator !== null) {
            $builder->where('created_uid', $operator);
        }

        /** @var null|ApiKeyProviderModel $model */
        $model = $builder->first();

        if (! $model) {
            return null;
        }

        return ApiKeyProviderFactory::modelToEntity($model);
    }

    public function getBySecretKey(AuthenticationDataIsolation $dataIsolation, string $secretKey): ?ApiKeyProviderEntity
    {
        $builder = $this->createBuilder($dataIsolation, ApiKeyProviderModel::query());
        /** @var null|ApiKeyProviderModel $model */
        $model = $builder->where('secret_key', $secretKey)->first();

        if (! $model) {
            return null;
        }

        return ApiKeyProviderFactory::modelToEntity($model);
    }

    /**
     * @return array{total: int, list: array<ApiKeyProviderEntity>}
     */
    public function queries(AuthenticationDataIsolation $dataIsolation, ApiKeyProviderQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, ApiKeyProviderModel::query());

        if ($query->getName()) {
            $builder->where('name', 'like', '%' . $query->getName() . '%');
        }

        if ($query->getRelType()) {
            $builder->where('type', $query->getRelType()->value);
        }

        if ($query->getRelCode()) {
            $builder->where('flow_code', $query->getRelCode());
        }

        if ($query->getCreator()) {
            $builder->where('created_uid', $query->getCreator());
        }

        $result = $this->getByPage($builder, $page, $query);
        $list = [];

        /** @var ApiKeyProviderModel $model */
        foreach ($result['list'] as $model) {
            $list[] = ApiKeyProviderFactory::modelToEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    public function destroy(AuthenticationDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, ApiKeyProviderModel::query());
        return (bool) $builder->where('code', $code)->delete();
    }
}
