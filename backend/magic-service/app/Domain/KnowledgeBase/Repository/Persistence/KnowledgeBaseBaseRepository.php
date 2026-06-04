<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence;

use App\Domain\Flow\Factory\MagicFlowKnowledgeFactory;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\KnowledgeBaseModel;
use App\Infrastructure\Core\ValueObject\Page;

use function mb_substr;

class KnowledgeBaseBaseRepository extends KnowledgeBaseAbstractRepository implements KnowledgeBaseRepositoryInterface
{
    private const string COLLECTION_META_CODE = '__qdrant_collection_meta__';

    protected bool $filterOrganizationCode = true;

    public function getByCode(KnowledgeBaseDataIsolation $dataIsolation, string $code): ?KnowledgeBaseEntity
    {
        if (empty($code)) {
            return null;
        }
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseModel::query());
        /** @var null|KnowledgeBaseModel $model */
        $model = $builder->where('code', $code)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowKnowledgeFactory::modelToEntity($model);
    }

    public function getByCodes(KnowledgeBaseDataIsolation $dataIsolation, array $codes): array
    {
        if (empty($codes)) {
            return [];
        }
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseModel::query());
        $models = $builder->whereIn('code', $codes)->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = MagicFlowKnowledgeFactory::modelToEntity($model);
        }
        return $result;
    }

    public function save(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $magicFlowKnowledgeEntity): KnowledgeBaseEntity
    {
        if (! $magicFlowKnowledgeEntity->getId()) {
            $model = new KnowledgeBaseModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, KnowledgeBaseModel::query());
            /** @var KnowledgeBaseModel $model */
            $model = $builder->where('id', $magicFlowKnowledgeEntity->getId())->first();
        }

        $model->fill(MagicFlowKnowledgeFactory::entityToAttributes($magicFlowKnowledgeEntity));
        $model->save();

        $magicFlowKnowledgeEntity->setId($model->id);

        return $magicFlowKnowledgeEntity;
    }

    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseModel::query());

        if (! is_null($query->getCodes())) {
            $builder->whereIn('code', $query->getCodes());
        }
        if (! is_null($query->getTypes())) {
            $builder->whereIn('type', $query->getTypes());
        }
        if (! is_null($query->getEnabled())) {
            $builder->where('enabled', $query->getEnabled());
        }
        if (! is_null($query->getBusinessId())) {
            $builder->where('business_id', $query->getBusinessId());
        }
        if (! is_null($query->getBusinessIds())) {
            $builder->whereIn('business_id', $query->getBusinessIds());
        }

        if ($query->getType()) {
            $builder->where('type', $query->getType());
        }

        if ($query->getName()) {
            $builder->where('name', 'like', "%{$query->getName()}%");
        }

        if ($query->getLastId() !== null) {
            $builder->where('id', '>', $query->getLastId());
            $builder->orderBy('id', 'asc');
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowKnowledgeFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $magicFlowKnowledgeEntity): void
    {
        if (empty($magicFlowKnowledgeEntity->getId())) {
            return;
        }
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseModel::query());
        $builder->where('id', $magicFlowKnowledgeEntity->getId())->delete();
    }

    public function changeSyncStatus(KnowledgeBaseEntity $entity): void
    {
        if (empty($entity->getId())) {
            return;
        }
        $update = [
            'sync_status' => $entity->getSyncStatus()->value,
        ];
        if (! empty($entity->getSyncStatusMessage())) {
            $update['sync_status_message'] = mb_substr($entity->getSyncStatusMessage(), 0, 900);
        }
        if (! empty($entity->getVersion())) {
            $update['version'] = $entity->getVersion();
        }
        KnowledgeBaseModel::withTrashed()->where('id', $entity->getId())->update($update);
    }

    public function exist(KnowledgeBaseDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseModel::query());
        return $builder->where('code', $code)->exists();
    }

    /**
     * 更新知识库词数统计
     */
    public function updateWordCount(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, int $deltaWordCount): void
    {
        if ($deltaWordCount === 0) {
            return;
        }
        $this->createBuilder($dataIsolation, KnowledgeBaseModel::query())
            ->where('code', $knowledgeCode)
            ->increment('word_count', $deltaWordCount);
    }

    public function getAllEmbeddingModelIds(): array
    {
        $rows = KnowledgeBaseModel::query()
            ->whereNull('deleted_at')
            ->where('code', '<>', self::COLLECTION_META_CODE)
            ->select(['model', 'embedding_config'])
            ->get();

        $modelIds = [];
        foreach ($rows as $row) {
            $embeddingConfig = is_array($row->embedding_config) ? $row->embedding_config : [];
            $modelId = trim((string) ($embeddingConfig['model_id'] ?? $row->model ?? ''));
            if ($modelId === '') {
                continue;
            }
            $modelIds[$modelId] = true;
        }

        $modelIds = array_keys($modelIds);
        sort($modelIds);
        return $modelIds;
    }

    public function getCurrentEmbeddingModelId(): string
    {
        $collectionMetaModelId = KnowledgeBaseModel::query()
            ->whereNull('deleted_at')
            ->where('code', self::COLLECTION_META_CODE)
            ->value('model');

        $modelId = trim((string) $collectionMetaModelId);
        if ($modelId !== '') {
            return $modelId;
        }

        $modelIds = $this->getAllEmbeddingModelIds();
        if (count($modelIds) !== 1) {
            return '';
        }

        return $modelIds[0];
    }
}
