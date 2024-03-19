<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence;

use App\Domain\Flow\Factory\MagicFlowKnowledgeFragmentFactory;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseFragmentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\KnowledgeBaseFragmentsModel;
use App\Infrastructure\Core\UnderlineObjectJsonSerializable;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Codec\Json;

use function mb_substr;

class KnowledgeBaseFragmentRepository extends KnowledgeBaseAbstractRepository implements KnowledgeBaseFragmentRepositoryInterface
{
    public function getById(KnowledgeBaseDataIsolation $dataIsolation, int $id, bool $selectForUpdate = false): ?KnowledgeBaseFragmentEntity
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        /** @var null|KnowledgeBaseFragmentsModel $model */
        $model = $builder
            ->when($selectForUpdate, function ($builder) {
                return $builder->lockForUpdate();
            })
            ->find($id);
        return $model ? MagicFlowKnowledgeFragmentFactory::modelToEntity($model) : null;
    }

    public function getByIds(KnowledgeBaseDataIsolation $dataIsolation, array $ids, bool $selectForUpdate = false): array
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $res = $builder
            ->when($selectForUpdate, function ($builder) {
                return $builder->lockForUpdate();
            })
            ->whereIn('id', $ids)
            ->get()
            ->toArray();
        return array_map(fn ($item) => new KnowledgeBaseFragmentEntity($item), $res);
    }

    public function getByBusinessId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $businessId): ?KnowledgeBaseFragmentEntity
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        /** @var null|KnowledgeBaseFragmentsModel $model */
        $model = $builder->where('knowledge_code', $knowledgeCode)->where('business_id', $businessId)->first();
        return $model ? MagicFlowKnowledgeFragmentFactory::modelToEntity($model) : null;
    }

    public function getByPointId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $pointId): ?KnowledgeBaseFragmentEntity
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        /** @var null|KnowledgeBaseFragmentsModel $model */
        $model = $builder->where('knowledge_code', $knowledgeCode)->where('point_id', $pointId)->first();
        return $model ? MagicFlowKnowledgeFragmentFactory::modelToEntity($model) : null;
    }

    public function getFragmentsByPointId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $pointId, bool $selectForUpdate = false): array
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $res = $builder
            ->when($selectForUpdate, function ($builder) {
                return $builder->lockForUpdate();
            })
            ->where('knowledge_code', $knowledgeCode)
            ->where('point_id', $pointId)
            ->orderBy('version', 'desc')
            ->get()
            ->toArray();
        return array_map(fn ($item) => new KnowledgeBaseFragmentEntity($item), $res);
    }

    public function save(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentEntity $magicFlowKnowledgeFragmentEntity): KnowledgeBaseFragmentEntity
    {
        /* @var KnowledgeBaseFragmentsModel $model */
        if ($magicFlowKnowledgeFragmentEntity->getId()) {
            $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
            $model = $builder->where('id', $magicFlowKnowledgeFragmentEntity->getId())->first();
        } else {
            $model = new KnowledgeBaseFragmentsModel();
        }

        $model->fill($this->getAttributes($magicFlowKnowledgeFragmentEntity));
        $model->save();

        $magicFlowKnowledgeFragmentEntity->setId($model->id);
        return $magicFlowKnowledgeFragmentEntity;
    }

    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentQuery $query, Page $page): array
    {
        $builder = KnowledgeBaseFragmentsModel::query();

        $builder = $this->createBuilder($dataIsolation, $builder);

        if ($query->getKnowledgeCode()) {
            $builder->where('knowledge_code', $query->getKnowledgeCode());
        }
        if ($query->getDocumentCode() || $query->isDefaultDocumentCode()) {
            $documentCodes = [$query->getDocumentCode()];
            // 兼容旧知识库片段，因为旧的知识库没有文档概念，如果是默认文档，就把旧知识库片段一起查出来
            $query->isDefaultDocumentCode() && $documentCodes[] = '';
            $builder->whereIn('document_code', $documentCodes);
        }
        if (! is_null($query->getSyncStatus())) {
            $builder->where('sync_status', $query->getSyncStatus());
        }
        if ($query->getSyncStatuses()) {
            $builder->whereIn('sync_status', $query->getSyncStatuses());
        }
        if (! is_null($query->getMaxSyncTimes())) {
            $builder->where('sync_times', '<', $query->getMaxSyncTimes());
        }
        if ($query->getVersion()) {
            $builder->where('version', $query->getVersion());
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowKnowledgeFragmentFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function count(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentQuery $query): int
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());

        if ($query->getKnowledgeCode()) {
            $builder->where('knowledge_code', $query->getKnowledgeCode());
        }
        if (! is_null($query->getSyncStatus())) {
            $builder->where('sync_status', $query->getSyncStatus());
        }

        return $builder->count();
    }

    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentEntity $magicFlowKnowledgeFragmentEntity): void
    {
        if (empty($magicFlowKnowledgeFragmentEntity->getId())) {
            return;
        }
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $builder->where('id', $magicFlowKnowledgeFragmentEntity->getId())->delete();
    }

    public function fragmentBatchDestroy(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, array $fragmentIds): void
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $builder->where('knowledge_code', $knowledgeCode)->whereIn('id', $fragmentIds)->delete();
    }

    public function destroyByKnowledgeCode(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode): void
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $builder->where('knowledge_code', $knowledgeCode)->delete();
    }

    public function changeSyncStatus(KnowledgeBaseFragmentEntity $entity): void
    {
        $update = [
            'sync_status' => $entity->getSyncStatus()->value,
        ];

        if (! empty($entity->getSyncStatusMessage())) {
            $update['sync_status_message'] = mb_substr($entity->getSyncStatusMessage(), 0, 900);
        }
        if (! empty($entity->getVector())) {
            $update['vector'] = $entity->getVector();
        }

        if (in_array($entity->getSyncStatus(), [KnowledgeSyncStatus::Synced, KnowledgeSyncStatus::SyncFailed])) {
            KnowledgeBaseFragmentsModel::where('id', $entity->getId())->increment('sync_times', 1, $update);
        } else {
            KnowledgeBaseFragmentsModel::where('id', $entity->getId())->update($update);
        }
    }

    public function batchChangeSyncStatus(array $ids, KnowledgeSyncStatus $syncStatus, string $syncMessage = ''): void
    {
        $update = [
            'sync_status' => $syncStatus->value,
        ];

        if (! empty($syncMessage)) {
            $update['sync_status_message'] = mb_substr($syncMessage, 0, 900);
        }

        if (in_array($syncStatus, [KnowledgeSyncStatus::Synced, KnowledgeSyncStatus::SyncFailed])) {
            KnowledgeBaseFragmentsModel::whereIn('id', $ids)->increment('sync_times', 1, $update);
        } else {
            KnowledgeBaseFragmentsModel::whereIn('id', $ids)->update($update);
        }
    }

    public function rebuildByKnowledgeCode(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode): void
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $builder->where('knowledge_code', $knowledgeCode)->update([
            'sync_status' => KnowledgeSyncStatus::Rebuilding->value,
            'sync_times' => 0,
        ]);
    }

    public function fragmentBatchDestroyByPointIds(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, array $pointIds): void
    {
        $pointIds = array_values(array_unique($pointIds));
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $builder->where('knowledge_code', $knowledgeCode)->whereIn('point_id', $pointIds)->delete();
    }

    /**
     * @return array<string, KnowledgeSyncStatus>
     */
    public function getFinalSyncStatusByDocumentCodes(KnowledgeBaseDataIsolation $dataIsolation, array $documentCodes): array
    {
        if (empty($documentCodes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $results = $builder
            ->select('document_code', 'sync_status')
            ->whereIn('document_code', $documentCodes)
            ->get();

        // 按document_code分组
        $groupedResults = [];
        foreach ($results as $result) {
            if (! isset($groupedResults[$result->document_code])) {
                $groupedResults[$result->document_code] = [];
            }
            $groupedResults[$result->document_code][] = $result->sync_status;
        }

        // 判断每个文档的整体状态
        $statusMap = [];
        foreach ($groupedResults as $documentCode => $statuses) {
            if (in_array(KnowledgeSyncStatus::Syncing->value, $statuses)) {
                $statusMap[$documentCode] = KnowledgeSyncStatus::Syncing;
            } elseif (count(array_unique($statuses)) === 1 && $statuses[0] === KnowledgeSyncStatus::NotSynced->value) {
                $statusMap[$documentCode] = KnowledgeSyncStatus::NotSynced;
            } else {
                $statusMap[$documentCode] = KnowledgeSyncStatus::Synced;
            }
        }

        return $statusMap;
    }

    public function getFragmentsByEmptyDocumentCode(KnowledgeBaseDataIsolation $dataIsolation, ?int $lastId = null, int $pageSize = 500): array
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $res = $builder->where('document_code', '')
            ->when($lastId, function ($builder) use ($lastId) {
                return $builder->where('id', '<', $lastId);
            })
            ->limit($pageSize)
            ->orderBy('id', 'desc')
            ->get()
            ->toArray();
        return array_map(fn (array $item) => (new KnowledgeBaseFragmentEntity($item))->setCreator($item['created_uid']), $res);
    }

    public function upsertById(KnowledgeBaseDataIsolation $dataIsolation, array $fragmentEntities): void
    {
        $attributes = [];
        foreach ($fragmentEntities as $fragmentEntity) {
            $attr = $this->getAttributes($fragmentEntity);
            unset($attr['score']);
            foreach ($attr as $attrKey => $attrValue) {
                if (is_array($attrValue)) {
                    $attr[$attrKey] = Json::encode($attrValue);
                } elseif ($attrValue instanceof UnderlineObjectJsonSerializable) {
                    $attr[$attrKey] = $attrValue->toJsonString();
                }
            }
            $attributes[] = $attr;
        }
        KnowledgeBaseFragmentsModel::query()
            ->upsert($attributes, ['id']);
    }
}
