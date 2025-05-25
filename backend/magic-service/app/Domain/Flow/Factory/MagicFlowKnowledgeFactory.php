<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\KnowledgeBaseModel;
use Hyperf\Codec\Json;

class MagicFlowKnowledgeFactory
{
    public static function modelToEntity(KnowledgeBaseModel $model): KnowledgeBaseEntity
    {
        $entity = new KnowledgeBaseEntity();
        $entity->setId($model->id);
        $entity->setCode($model->code);
        $entity->setVersion($model->version);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setType($model->type);
        $entity->setEnabled($model->enabled);
        $entity->setBusinessId($model->business_id);
        $entity->setSyncStatus(KnowledgeSyncStatus::from($model->sync_status));
        $entity->setSyncStatusMessage($model->sync_status_message);
        $entity->setModel($model->model);
        $entity->setVectorDb($model->vector_db);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);
        $entity->setExpectedNum($model->expected_num);
        $entity->setCompletedNum($model->completed_num);
        $entity->setIcon($model->icon);
        $entity->setWordCount($model->word_count);
        $entity->setFragmentConfig($model->fragment_config);
        $entity->setEmbeddingConfig($model->embedding_config);
        $entity->setSourceType($model->source_type);

        // 处理检索配置
        if (! empty($model->retrieve_config)) {
            // 如果是字符串（JSON 字符串），先解码
            $config = json_decode($model->retrieve_config, true);

            if (is_array($config)) {
                $entity->setRetrieveConfig(RetrieveConfig::fromArray($config));
            } else {
                // 如果配置无效，设置默认配置
                $entity->setRetrieveConfig(RetrieveConfig::createDefault());
            }
        } else {
            // 如果配置为空，设置默认配置
            $entity->setRetrieveConfig(RetrieveConfig::createDefault());
        }

        return $entity;
    }

    /**
     * 将实体转换为模型属性数组.
     */
    public static function entityToAttributes(KnowledgeBaseEntity $entity): array
    {
        $attributes = [
            'code' => $entity->getCode(),
            'version' => $entity->getVersion(),
            'name' => $entity->getName(),
            'description' => $entity->getDescription(),
            'type' => $entity->getType(),
            'enabled' => $entity->isEnabled(),
            'business_id' => $entity->getBusinessId(),
            'sync_status' => $entity->getSyncStatus()->value,
            'sync_status_message' => $entity->getSyncStatusMessage(),
            'model' => $entity->getModel(),
            'vector_db' => $entity->getVectorDb(),
            'organization_code' => $entity->getOrganizationCode(),
            'created_uid' => $entity->getCreator(),
            'created_at' => $entity->getCreatedAt(),
            'updated_uid' => $entity->getModifier(),
            'updated_at' => $entity->getUpdatedAt(),
            'expected_num' => $entity->getExpectedNum(),
            'completed_num' => $entity->getCompletedNum(),
            'fragment_config' => $entity->getFragmentConfig()?->toArray(),
            'embedding_config' => $entity->getEmbeddingConfig(),
            'icon' => $entity->getIcon(),
            'source_type' => $entity->getSourceType(),
        ];

        // 处理检索配置
        if ($entity->getRetrieveConfig() !== null) {
            $attributes['retrieve_config'] = json_encode($entity->getRetrieveConfig()->toArray());
        }

        return $attributes;
    }
}
