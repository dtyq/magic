<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGenerator;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreDriver;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class KnowledgeBaseAppService extends AbstractKnowledgeAppService
{
    /**
     * @param array<DocumentFileInterface> $documentFiles
     */
    public function save(Authenticatable $authorization, KnowledgeBaseEntity $magicFlowKnowledgeEntity, array $documentFiles = []): KnowledgeBaseEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $magicFlowKnowledgeEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $magicFlowKnowledgeEntity->setCreator($dataIsolation->getCurrentUserId());

        $oldKnowledge = null;
        // 如果具有业务 id，那么就是更新了，需要先查询出来
        if (! empty($magicFlowKnowledgeEntity->getBusinessId())) {
            $oldKnowledge = $this->getByBusinessId($authorization, $magicFlowKnowledgeEntity->getBusinessId());
            if ($oldKnowledge) {
                $magicFlowKnowledgeEntity->setCode($oldKnowledge->getCode());
            }
        }

        // 更新数据 - 查询权限
        if (! $magicFlowKnowledgeEntity->shouldCreate() && ! $oldKnowledge) {
            $oldKnowledge = $this->knowledgeBaseDomainService->show($dataIsolation, $magicFlowKnowledgeEntity->getCode(), false);
        }
        $operation = Operation::None;
        if ($oldKnowledge) {
            $operation = $this->knowledgeBaseStrategy->getKnowledgeOperation($dataIsolation, $oldKnowledge->getCode());
            $operation->validate('w', $oldKnowledge->getCode());

            // 使用原来的模型和向量库
            $magicFlowKnowledgeEntity->setModel($oldKnowledge->getModel());
            $magicFlowKnowledgeEntity->setVectorDB($oldKnowledge->getVectorDB());
        }
        $modelGatewayMapper = di(ModelGatewayMapper::class);

        // 创建的才需要设置
        if ($magicFlowKnowledgeEntity->shouldCreate()) {
            $modelId = $magicFlowKnowledgeEntity->getEmbeddingConfig()['model_id'] ?? null;
            if (! $modelId) {
                // 优先使用配置的模型
                $modelId = EmbeddingGenerator::defaultModel();
                if (! $modelGatewayMapper->exists($modelId, $dataIsolation->getCurrentOrganizationCode())) {
                    // 获取第一个
                    $firstEmbeddingModel = $modelGatewayMapper->getEmbeddingModels($dataIsolation->getCurrentOrganizationCode())[0] ?? null;
                    $modelId = $firstEmbeddingModel?->getKey();
                }
                // 更新嵌入配置model_id
                $embeddingConfig = $magicFlowKnowledgeEntity->getEmbeddingConfig();
                $embeddingConfig['model_id'] = $modelId;
                $magicFlowKnowledgeEntity->setEmbeddingConfig($embeddingConfig);
            }
            if (! $modelId) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.model.error_config_missing', ['name' => 'embedding_model']);
            }

            $magicFlowKnowledgeEntity->setModel($modelId);
            $magicFlowKnowledgeEntity->setVectorDB(VectorStoreDriver::default()->value);
        }

        $modelName = $magicFlowKnowledgeEntity->getModel();
        $magicFlowKnowledgeEntity->setForceCreateCode(Code::Knowledge->gen());
        // 创建知识库前，先对嵌入模型进行连通性测试
        try {
            $embeddingModel = di(ModelGatewayMapper::class)->getEmbeddingModelProxy($magicFlowKnowledgeEntity->getModel(), $dataIsolation->getCurrentOrganizationCode());
            $modelName = $embeddingModel->getModelName();
            $embeddingResult = $embeddingModel->embedding(
                'test.' . uniqid(),
                businessParams: [
                    'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'business_id' => $magicFlowKnowledgeEntity->getForceCreateCode(),
                    'source_id' => 'knowledge_embedding_test',
                    'knowledge_info' => [
                        'id' => $magicFlowKnowledgeEntity->getId(),
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'code' => $magicFlowKnowledgeEntity->getForceCreateCode(),
                        'name' => $magicFlowKnowledgeEntity->getName(),
                        'business_id' => $magicFlowKnowledgeEntity->getBusinessId(),
                    ],
                ]
            );
            if (count($embeddingResult->getEmbeddings()) !== $embeddingModel->getVectorSize()) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.model.vector_size_not_match', ['model_name' => $modelName]);
            }
        } catch (Throwable $exception) {
            simple_logger('KnowledgeBaseDomainService')->warning('KnowledgeBaseCheckEmbeddingsFailed', [
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.model.embedding_failed', ['model_name' => $modelName]);
        }

        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->save($dataIsolation, $magicFlowKnowledgeEntity, $documentFiles);
        $knowledgeBaseEntity->setUserOperation($operation->value);
        $iconFileLink = $this->getFileLink($dataIsolation->getCurrentOrganizationCode(), $knowledgeBaseEntity->getIcon());
        $knowledgeBaseEntity->setIcon($iconFileLink?->getUrl() ?? '');
        $knowledgeBaseEntity->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($knowledgeBaseEntity));
        return $knowledgeBaseEntity;
    }

    public function saveProcess(Authenticatable $authorization, KnowledgeBaseEntity $savingKnowledgeEntity): KnowledgeBaseEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $savingKnowledgeEntity->setCreator($dataIsolation->getCurrentUserId());
        $this->checkKnowledgeBaseOperation($dataIsolation, 'w', $savingKnowledgeEntity->getCode());

        $entity = $this->knowledgeBaseDomainService->saveProcess($dataIsolation, $savingKnowledgeEntity);
        $entity->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($entity));
        return $entity;
    }

    public function getByBusinessId(Authenticatable $authorization, string $businessId, ?int $type = null): ?KnowledgeBaseEntity
    {
        if (empty($businessId)) {
            return null;
        }
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);

        $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::Knowledge,
            [$authorization->getId()]
        )[$authorization->getId()] ?? [];
        $resourceIds = array_keys($resources);
        // 在这一堆中查找一个
        $query = new KnowledgeBaseQuery();
        $query->setCodes($resourceIds);
        $query->setBusinessId($businessId);
        $query->setType($type);
        $result = $this->knowledgeBaseDomainService->queries($dataIsolation, $query, new Page(1, 1));
        $entity = $result['list'][0] ?? null;
        $entity && $entity->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($entity));
        return $entity;
    }

    /**
     * @return array{total: int, list: array<KnowledgeBaseEntity>, users: array<MagicUserEntity>}
     */
    public function queries(Authenticatable $authorization, KnowledgeBaseQuery $query, Page $page): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);

        $resources = $this->knowledgeBaseStrategy->getKnowledgeBaseOperations($dataIsolation);

        $query->setCodes(array_keys($resources));
        $result = $this->knowledgeBaseDomainService->queries($dataIsolation, $query, $page);
        $userIds = [];
        $iconFileLinks = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), array_map(fn ($item) => $item->getIcon(), $result['list']));
        foreach ($result['list'] as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
            $iconFileLink = $iconFileLinks[$item->getIcon()] ?? null;
            $item->setIcon($iconFileLink?->getUrl() ?? '');
            $item->setUserOperation(($resources[$item->getCode()] ?? Operation::None)->value);
            $item->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($item));
        }
        $result['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolationByBase($dataIsolation), $userIds);
        return $result;
    }

    public function show(Authenticatable $authorization, string $code): KnowledgeBaseEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $operation = $this->checkKnowledgeBaseOperation($dataIsolation, 'r', $code);
        $knowledge = $this->knowledgeBaseDomainService->show($dataIsolation, $code, true);
        $knowledge->setUserOperation($operation->value);
        $knowledge->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($knowledge));
        $iconFileLink = $this->fileDomainService->getLink($dataIsolation->getCurrentOrganizationCode(), $knowledge->getIcon());
        $knowledge->setIcon($iconFileLink?->getUrl() ?? '');
        return $knowledge;
    }

    public function destroy(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'del', $code);
        $magicFlowKnowledgeEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $code);
        $this->knowledgeBaseDomainService->destroy($dataIsolation, $magicFlowKnowledgeEntity);
    }
}
