<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\AccessTokenQuery;
use App\Domain\ModelGateway\Entity\ValueObject\SystemAccessTokenManager;
use App\Domain\ModelGateway\Factory\AccessTokenFactory;
use App\Domain\ModelGateway\Repository\Facade\AccessTokenRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\Model\AccessTokenModel;
use App\Infrastructure\Core\ValueObject\Page;

class AccessTokenRepository extends AbstractRepository implements AccessTokenRepositoryInterface
{
    protected array $attributeMaps = [];

    public function save(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity): AccessTokenEntity
    {
        if (SystemAccessTokenManager::getByEncryptedAccessToken($accessTokenEntity->getEncryptedAccessToken())) {
            return $accessTokenEntity;
        }
        if ($accessTokenEntity->getId()) {
            $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
            /** @var AccessTokenModel $model */
            $model = $builder->where('id', $accessTokenEntity->getId())->first();
        } else {
            $model = new AccessTokenModel();
        }
        $model->fill($this->getAttributes($accessTokenEntity));
        $model->save();

        $accessTokenEntity->setId($model->id);
        $accessTokenEntity->setCreatedAt($model->created_at);
        $accessTokenEntity->setUpdatedAt($model->updated_at);
        return $accessTokenEntity;
    }

    public function getById(LLMDataIsolation $dataIsolation, int $id): ?AccessTokenEntity
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        /** @var null|AccessTokenModel $model */
        $model = $builder->where('id', $id)->first();
        return $model ? AccessTokenFactory::modelToEntity($model) : null;
    }

    public function queries(LLMDataIsolation $dataIsolation, Page $page, AccessTokenQuery $query): array
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        if (! is_null($query->getType())) {
            $builder->where('type', $query->getType());
        }
        if (! is_null($query->getCreator())) {
            $builder->where('creator', $query->getCreator());
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = AccessTokenFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }
        return $data;
    }

    public function destroy(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity): void
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        $builder->where('id', $accessTokenEntity->getId())->delete();
    }

    public function countByTypeAndRelationId(LLMDataIsolation $dataIsolation, AccessTokenType $type, string $relationId): int
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        return $builder->where('relation_id', $relationId)->count();
    }

    public function getByAccessToken(LLMDataIsolation $dataIsolation, string $accessToken): ?AccessTokenEntity
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        /** @var null|AccessTokenModel $model */
        $model = $builder->where('access_token', $accessToken)->first();
        return $model ? AccessTokenFactory::modelToEntity($model) : null;
    }

    public function getByEncryptedAccessToken(LLMDataIsolation $dataIsolation, string $encryptedAccessToken): ?AccessTokenEntity
    {
        $systemAccessToken = SystemAccessTokenManager::getByEncryptedAccessToken($encryptedAccessToken);
        if ($systemAccessToken) {
            return $systemAccessToken;
        }
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        /** @var null|AccessTokenModel $model */
        $model = $builder->where('encrypted_access_token', $encryptedAccessToken)->first();
        return $model ? AccessTokenFactory::modelToEntity($model) : null;
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity, float $amount): void
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        $builder->where('id', $accessTokenEntity->getId())->increment('use_amount', $amount);
    }

    public function getByName(LLMDataIsolation $dataIsolation, string $name): ?AccessTokenEntity
    {
        $builder = $this->createBuilder($dataIsolation, AccessTokenModel::query());
        /** @var null|AccessTokenModel $model */
        $model = $builder->where('name', $name)->first();
        return $model ? AccessTokenFactory::modelToEntity($model) : null;
    }
}
