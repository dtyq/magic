<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGenerator;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreDriver;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;

abstract class AbstractKnowledgeNodeRunner extends NodeRunner
{
    protected function getKnowledgeCodeByVectorDatabaseId(?Component $vectorDatabaseIdComponent, ExecutionData $executionData, string $knowledgeCode): string
    {
        if ($vectorDatabaseIdComponent) {
            $vectorDatabaseId = $vectorDatabaseIdComponent->getValue()->getResult($executionData->getExpressionFieldData());
            if (is_string($vectorDatabaseId) && ! empty($vectorDatabaseId)) {
                // 如果本身就已经是 id 了，那么直接返回
                $knowledgeCode = $vectorDatabaseId;
            } elseif (is_array($vectorDatabaseId)) {
                // 这里采用了 names 的组件形式，那么结构是一个多选
                // 只取第一个的 id
                $knowledgeCode = $vectorDatabaseId[0]['id'] ?? '';
            }
        }
        if (ConstValue::isSystemKnowledge($knowledgeCode)) {
            $knowledgeCode = $this->transformSystemKnowledgeCode($executionData, $knowledgeCode);
        }
        if (empty($knowledgeCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge.knowledge_code_empty');
        }
        return $knowledgeCode;
    }

    protected function getKnowledgeCodesByVectorDatabaseIds(?Component $vectorDatabaseIdsComponent, ExecutionData $executionData, array $knowledgeCodes): array
    {
        if ($vectorDatabaseIdsComponent) {
            $vectorDatabaseIds = $vectorDatabaseIdsComponent->getValue()->getResult($executionData->getExpressionFieldData());
            if (is_array($vectorDatabaseIds)) {
                $newKnowledgeCodes = [];
                foreach ($vectorDatabaseIds as $vectorDatabaseId) {
                    if (is_string($vectorDatabaseId)) {
                        $newKnowledgeCodes[] = $vectorDatabaseId;
                    } elseif (is_array($vectorDatabaseId)) {
                        $newKnowledgeCodes[] = $vectorDatabaseId['id'] ?? null;
                    }
                }
                $knowledgeCodes = $newKnowledgeCodes;
            }
        }
        foreach ($knowledgeCodes as $index => $knowledgeCode) {
            if (ConstValue::isSystemKnowledge($knowledgeCode)) {
                $knowledgeCodes[$index] = $this->transformSystemKnowledgeCode($executionData, $knowledgeCode);
            }
        }
        $knowledgeCodes = array_filter($knowledgeCodes);
        if (empty($knowledgeCodes)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge.knowledge_code_empty');
        }
        return $knowledgeCodes;
    }

    private function transformSystemKnowledgeCode(ExecutionData $executionData, string $systemKnowledgeCode): string
    {
        $dataIsolation = $executionData->getDataIsolation();
        switch ($systemKnowledgeCode) {
            case ConstValue::KNOWLEDGE_USER_CURRENT_TOPIC:
                $knowledgeEntity = KnowledgeBaseEntity::createCurrentTopicTemplate($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
                $knowledgeEntity->setForceCreateCode(Code::Knowledge->genUserTopic($executionData->getOriginConversationId(), $executionData->getTopicIdString()));
                $knowledgeEntity->setBusinessId($executionData->getOriginConversationId() . '_' . $executionData->getTopicIdString());
                break;
            case ConstValue::KNOWLEDGE_USER_CURRENT_CONVERSATION:
                $knowledgeEntity = KnowledgeBaseEntity::createConversationTemplate($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
                $knowledgeEntity->setForceCreateCode(Code::Knowledge->genUserConversation($executionData->getOriginConversationId()));
                $knowledgeEntity->setBusinessId($executionData->getOriginConversationId());
                break;
            default: $knowledgeEntity = null;
        }
        if (! $knowledgeEntity) {
            return '';
        }

        $create = false;
        // 只有存储片段时，需要新增知识库
        if ($this->node->getNodeType() === NodeType::KnowledgeFragmentStore->value) {
            $create = true;
        }

        $knowledgeDomainService = di(KnowledgeBaseDomainService::class);

        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $dataIsolation->getMagicId());
        if ($create && ! $knowledgeDomainService->exist($knowledgeBaseDataIsolation, $knowledgeEntity->getForceCreateCode())) {
            // 选择合适的嵌入和向量
            $knowledgeEntity->setModel($knowledgeEntity->getEmbeddingConfig()['model_id'] ?? EmbeddingGenerator::defaultModel());
            $knowledgeEntity->setVectorDB(VectorStoreDriver::default()->value);
            $knowledgeDomainService->save($knowledgeBaseDataIsolation, $knowledgeEntity);
        }
        return $knowledgeEntity->getForceCreateCode();
    }
}
