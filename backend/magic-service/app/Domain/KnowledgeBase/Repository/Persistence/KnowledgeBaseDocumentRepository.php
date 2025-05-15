<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence;

use App\Domain\Flow\Entity\ValueObject\Query\KnowledgeBaseDocumentQuery;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseDocumentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\KnowledgeBaseDocumentModel;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\KnowledgeBaseFragmentsModel;
use App\Infrastructure\Core\UnderlineObjectJsonSerializable;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;

use function mb_substr;

/**
 * 知识库文档仓库实现.
 */
class KnowledgeBaseDocumentRepository extends KnowledgeBaseAbstractRepository implements KnowledgeBaseDocumentRepositoryInterface
{
    public function __construct(protected ContainerInterface $container)
    {
    }

    /**
     * 创建知识库文档.
     */
    public function create(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity
    {
        // 准备数据
        $attributes = $this->prepareAttributes($documentEntity);
        $attributes['organization_code'] = $dataIsolation->getCurrentOrganizationCode();

        // 创建模型并保存
        $model = new KnowledgeBaseDocumentModel();
        $model->fill($attributes);
        $model->save();

        return new KnowledgeBaseDocumentEntity($model->toArray());
    }

    public function upsertByCode(KnowledgeBaseDataIsolation $dataIsolation, array $documentEntities): void
    {
        $attributes = array_map(function (KnowledgeBaseDocumentEntity $documentEntity) {
            $attrs = $this->prepareAttributes($documentEntity);
            $attrs['organization_code'] = $documentEntity->getOrganizationCode();
            $attrs['created_at'] = date('Y-m-d H:i:s');
            $attrs['updated_at'] = date('Y-m-d H:i:s');
            // 将数组类型的字段转换为 JSON 字符串
            foreach ($attrs as $key => $attr) {
                if (is_array($attr)) {
                    $attrs[$key] = Json::encode($attr);
                } elseif ($attr instanceof UnderlineObjectJsonSerializable) {
                    $attrs[$key] = $attr->toJsonString();
                }
            }
            return $attrs;
        }, $documentEntities);

        KnowledgeBaseDocumentModel::query()
            ->upsert($attributes, ['knowledge_base_code', 'code']);
    }

    public function restoreOrCreate(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity
    {
        // 准备数据
        $attributes = $this->prepareAttributes($documentEntity);
        $attributes['organization_code'] = $dataIsolation->getCurrentOrganizationCode();

        // 创建模型并保存
        $model = KnowledgeBaseDocumentModel::withTrashed()
            ->firstOrCreate(
                [
                    'knowledge_base_code' => $attributes['knowledge_base_code'] ?? null,
                    'code' => $attributes['code'] ?? null,
                ],
                $attributes
            );
        // 如果是软删除的，则恢复
        if ($model->trashed()) {
            $model->restore();
            $model->fill($attributes)->save();
        }

        return new KnowledgeBaseDocumentEntity($model->toArray());
    }

    /**
     * 更新知识库文档.
     */
    public function update(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity
    {
        // 查找文档
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query());
        $model = $builder->where('code', $documentEntity->getCode())->first();

        if (! $model) {
            return $documentEntity;
        }

        // 更新文档
        $attributes = $this->prepareAttributes($documentEntity);
        $model->fill($attributes);
        $model->save();

        return new KnowledgeBaseDocumentEntity($model->toArray());
    }

    public function updateDocumentFile(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): int
    {
        return $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query())
            ->where('id', $documentEntity->getId())
            ->update([
                'document_file' => $documentEntity->getDocumentFile(),
            ]);
    }

    public function updateWordCount(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode, int $deltaWordCount): void
    {
        if ($deltaWordCount === 0) {
            return;
        }
        $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query())
            ->where('knowledge_base_code', $knowledgeBaseCode)
            ->where('code', $documentCode)
            ->increment('word_count', $deltaWordCount);
    }

    /**
     * @return array<string, int> array<知识库code, 文档数量>
     */
    public function getDocumentCountByKnowledgeBaseCode(KnowledgeBaseDataIsolation $dataIsolation, array $knowledgeBaseCodes): array
    {
        // 分组聚合查询，获取每个知识库的文档数量
        $res = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query())
            ->select('knowledge_base_code', Db::raw('count(*) as count'))
            ->groupBy('knowledge_base_code')
            ->whereIn('knowledge_base_code', $knowledgeBaseCodes)
            ->get()
            ->toArray();
        $mapping = [];
        foreach ($res as $value) {
            $mapping[$value['knowledge_base_code']] = $value['count'];
        }
        return $mapping;
    }

    /**
     * @return array<string, KnowledgeBaseDocumentEntity> array<文档code, 文档名>
     */
    public function getDocumentsByCodes(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, array $knowledgeBaseDocumentCodes): array
    {
        // 获取每个文档的文档名
        $res = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query())
            ->where('knowledge_base_code', $knowledgeBaseCode)
            ->whereIn('code', $knowledgeBaseDocumentCodes)
            ->get()
            ->toArray();
        $mapping = [];
        foreach ($res as $value) {
            $mapping[$value['code']] = new KnowledgeBaseDocumentEntity($value);
        }
        return $mapping;
    }

    /**
     * 查询知识库文档列表.
     *
     * @return array{total: int, list: array<KnowledgeBaseDocumentEntity>}
     */
    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentQuery $query, Page $page): array
    {
        $builder = $this->createQueryBuilder($dataIsolation, $query);
        $result = $this->getByPage($builder, $page, $query);

        if (! empty($result['list'])) {
            $documents = [];
            foreach ($result['list'] as $model) {
                $documents[] = new KnowledgeBaseDocumentEntity($model->toArray());
            }
            $result['list'] = $documents;
        }

        return $result;
    }

    public function getByThirdFileId(KnowledgeBaseDataIsolation $dataIsolation, string $thirdPlatformType, string $thirdFileId, ?string $knowledgeBaseCode = null, ?int $lastId = null, int $pageSize = 500): array
    {
        $res = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query())
            ->where('third_platform_type', $thirdPlatformType)
            ->where('third_file_id', $thirdFileId)
            ->when($knowledgeBaseCode, function ($query) use ($knowledgeBaseCode) {
                return $query->where('knowledge_base_code', $knowledgeBaseCode);
            })
            ->when($lastId, function ($query) use ($lastId) {
                return $query->where('id', '<', $lastId);
            })
            ->limit($pageSize)
            ->orderBy('id', 'desc')
            ->get()
            ->toArray();

        return array_map(fn (array $item) => new KnowledgeBaseDocumentEntity($item), $res);
    }

    /**
     * 查看单个知识库文档详情.
     */
    public function show(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode, bool $selectForUpdate = false): ?KnowledgeBaseDocumentEntity
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query());
        if ($selectForUpdate) {
            $builder = $builder->lockForUpdate();
        }
        $model = $builder
            ->where('knowledge_base_code', $knowledgeBaseCode)
            ->where('code', $documentCode)
            ->orderBy('version', 'desc')
            ->first();

        return $model ? new KnowledgeBaseDocumentEntity($model->toArray()) : null;
    }

    /**
     * 删除知识库文档.
     */
    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode): void
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query());
        $builder
            ->where('knowledge_base_code', $knowledgeBaseCode)
            ->where('code', $documentCode)
            ->delete();
    }

    /**
     * 根据文档编码删除所有片段.
     */
    public function destroyFragmentsByDocumentCode(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode): void
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseFragmentsModel::query());
        $builder
            ->where('knowledge_code', $knowledgeBaseCode)
            ->where('document_code', $documentCode)
            ->delete();
    }

    /**
     * 重置文档同步状态
     */
    public function resetSyncStatus(KnowledgeBaseDataIsolation $dataIsolation, string $documentCode): void
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query());
        $builder->where('code', $documentCode)->update([
            'sync_status' => KnowledgeSyncStatus::NotSynced->value,
            'sync_status_message' => '',
            'sync_times' => 0,
        ]);
    }

    /**
     * 更新文档同步状态
     */
    public function updateSyncStatus(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): void
    {
        $update = [
            'sync_status' => $documentEntity->getSyncStatus(),
            'sync_status_message' => mb_substr($documentEntity->getSyncStatusMessage(), 0, 900),
        ];

        // 如果是已同步或同步失败状态，同步次数加1
        if (in_array($documentEntity->getSyncStatus(), [KnowledgeSyncStatus::Synced->value, KnowledgeSyncStatus::SyncFailed->value])) {
            KnowledgeBaseDocumentModel::withTrashed()
                ->where('id', $documentEntity->getId())
                ->increment('sync_times', 1, $update);
        } else {
            KnowledgeBaseDocumentModel::withTrashed()
                ->where('id', $documentEntity->getId())
                ->update($update);
        }
    }

    public function changeSyncStatus(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): void
    {
        KnowledgeBaseDocumentModel::query()
            ->where('id', $documentEntity->getId())
            ->update([
                'sync_status' => $documentEntity->getSyncStatus(),
                'sync_status_message' => $documentEntity->getSyncStatusMessage(),
            ]);
    }

    public function increaseVersion(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): int
    {
        return KnowledgeBaseDocumentModel::query()
            ->where('knowledge_base_code', $documentEntity->getKnowledgeBaseCode())
            ->where('code', $documentEntity->getCode())
            ->where('version', $documentEntity->getVersion())
            ->increment('version');
    }

    /**
     * 创建查询构建器.
     */
    protected function createQueryBuilder(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentQuery $query): Builder
    {
        $builder = $this->createBuilder($dataIsolation, KnowledgeBaseDocumentModel::query());

        // 按知识库编码过滤
        $builder->where('knowledge_base_code', $query->getKnowledgeBaseCode());

        // 按文档编码过滤
        if ($query->getCode() !== null) {
            $builder->where('code', $query->getCode());
        }

        // 按名称模糊查询
        if ($query->getName() !== null && $query->getName() !== '') {
            $builder->where('name', 'like', '%' . $query->getName() . '%');
        }

        // 按启用状态过滤
        if ($query->getEnabled() !== null) {
            $builder->where('enabled', $query->getEnabled());
        }

        // 按文档类型过滤
        if ($query->getDocType() !== null) {
            $builder->where('doc_type', $query->getDocType());
        }

        // 按创建者过滤
        if ($query->getCreatedUid() !== null) {
            $builder->where('created_uid', $query->getCreatedUid());
        }

        // 按更新者过滤
        if ($query->getUpdatedUid() !== null) {
            $builder->where('updated_uid', $query->getUpdatedUid());
        }

        // 按文档编码数组批量查询
        if ($query->getCodes() !== null && ! empty($query->getCodes())) {
            $builder->whereIn('code', $query->getCodes());
        }

        return $builder;
    }

    /**
     * 生成唯一文档编码
     */
    protected function generateDocumentCode(): string
    {
        return 'DOCUMENT-' . uniqid() . substr(md5(microtime()), 0, 8);
    }

    /**
     * 获取用于创建或更新模型的属性数组.
     */
    protected function prepareAttributes(KnowledgeBaseDocumentEntity $entity): array
    {
        $attributes = [
            'knowledge_base_code' => $entity->getKnowledgeBaseCode(),
            'name' => $entity->getName(),
            'description' => $entity->getDescription(),
            'version' => $entity->getVersion(),
            'enabled' => $entity->isEnabled(),
            'doc_type' => $entity->getDocType(),
            'doc_metadata' => $entity->getDocMetadata(),
            'sync_status' => $entity->getSyncStatus(),
            'sync_times' => $entity->getSyncTimes(),
            'sync_status_message' => $entity->getSyncStatusMessage(),
            'embedding_model' => $entity->getEmbeddingModel(),
            'vector_db' => $entity->getVectorDb(),
            'retrieve_config' => $entity->getRetrieveConfig(),
            'fragment_config' => $entity->getFragmentConfig(),
            'embedding_config' => $entity->getEmbeddingConfig(),
            'vector_db_config' => $entity->getVectorDbConfig(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
            'word_count' => $entity->getWordCount(),
            'deleted_at' => $entity->getDeletedAt(),
            'document_file' => $entity->getDocumentFile(),
            'third_file_id' => $entity->getThirdFileId(),
            'third_platform_type' => $entity->getThirdPlatformType(),
        ];

        if ($entity->getCode()) {
            $attributes['code'] = $entity->getCode();
        } else {
            $code = $this->generateDocumentCode();
            $attributes['code'] = $code;
            $entity->setCode($code);
        }

        return $attributes;
    }
}
