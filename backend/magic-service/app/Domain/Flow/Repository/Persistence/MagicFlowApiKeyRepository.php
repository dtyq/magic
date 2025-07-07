<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowApiKeyEntity;
use App\Domain\Flow\Entity\ValueObject\ApiKeyType;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowApiKeyQuery;
use App\Domain\Flow\Factory\MagicFlowApiKeyFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowApiKeyRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowApiKeyModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowApiKeyRepository extends MagicFlowAbstractRepository implements MagicFlowApiKeyRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function getBySecretKey(FlowDataIsolation $dataIsolation, string $secretKey): ?MagicFlowApiKeyEntity
    {
        if (empty($secretKey)) {
            return null;
        }
        $builder = $this->createBuilder($dataIsolation, MagicFlowApiKeyModel::query());
        /** @var null|MagicFlowApiKeyModel $model */
        $model = $builder->where('secret_key', $secretKey)->first();
        return $model ? MagicFlowApiKeyFactory::modelToEntity($model) : null;
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code, ?string $creator = null): ?MagicFlowApiKeyEntity
    {
        if (empty($code)) {
            return null;
        }
        $builder = $this->createBuilder($dataIsolation, MagicFlowApiKeyModel::query());
        $builder->where('code', $code);
        if (! is_null($creator)) {
            $builder->where('created_uid', $creator);
        }
        /** @var null|MagicFlowApiKeyModel $model */
        $model = $builder->first();
        return $model ? MagicFlowApiKeyFactory::modelToEntity($model) : null;
    }

    public function exist(FlowDataIsolation $dataIsolation, MagicFlowApiKeyEntity $magicFlowApiKeyEntity): bool
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowApiKeyModel::query());
        $builder->where('flow_code', $magicFlowApiKeyEntity->getFlowCode())
            ->where('conversation_id', $magicFlowApiKeyEntity->getConversationId());
        /* @phpstan-ignore-next-line */
        if ($magicFlowApiKeyEntity->getType() === ApiKeyType::Personal) {
            $builder->where('type', $magicFlowApiKeyEntity->getType()->value)
                ->where('created_uid', $magicFlowApiKeyEntity->getCreator());
        }

        return $builder->exists();
    }

    /**
     * @return array{total: int, list: array<MagicFlowApiKeyEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowApiKeyQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowApiKeyModel::query());
        if ($query->getFlowCode()) {
            $builder->where('flow_code', $query->getFlowCode());
        }
        if ($query->getType()) {
            $builder->where('type', $query->getType());
        }
        if ($query->getCreator()) {
            $builder->where('created_uid', $query->getCreator());
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowApiKeyFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }
        return $data;
    }

    public function save(FlowDataIsolation $dataIsolation, MagicFlowApiKeyEntity $magicFlowApiKeyEntity): MagicFlowApiKeyEntity
    {
        $model = $this->createBuilder($dataIsolation, MagicFlowApiKeyModel::query())
            ->where('code', $magicFlowApiKeyEntity->getCode())
            ->first();
        if (! $model) {
            $model = new MagicFlowApiKeyModel();
        }

        $model->fill($this->getAttributes($magicFlowApiKeyEntity));
        $model->save();
        $magicFlowApiKeyEntity->setId($model->id);
        return $magicFlowApiKeyEntity;
    }

    public function destroy(FlowDataIsolation $dataIsolation, string $code): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowApiKeyModel::query());
        $builder->where('code', $code)->delete();
    }
}
