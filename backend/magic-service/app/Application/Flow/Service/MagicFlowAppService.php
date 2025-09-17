<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Application\Kernel\SuperPermissionEnum;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\ConversationId;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeDebugResult;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfigFactory;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowQuery;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Event\MagicFlowChangeEnabledEvent;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\ErrorCode\FlowErrorCode;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Collector\BuiltInToolSet\BuiltInToolSetCollector;
use App\Infrastructure\Core\Contract\Flow\BuiltInToolInterface;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Expression\ExpressionDataSource\ExpressionDataSource;
use Hyperf\DbConnection\Annotation\Transactional;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowAppService extends AbstractFlowAppService
{
    public function nodeVersions(): array
    {
        return NodeParamsConfigFactory::getVersionList();
    }

    /**
     * 获取节点配置模板.
     */
    public function getNodeTemplate(Authenticatable $authorization, Node $node): Node
    {
        return $this->magicFlowDomainService->getNodeTemplate($this->createFlowDataIsolation($authorization), $node);
    }

    /**
     * 单节点调试.
     */
    public function singleDebugNode(Authenticatable $authorization, Node $node, array $nodeContexts = [], array $triggerConfig = []): ?NodeDebugResult
    {
        if (! $node->getNodeDefine()->isSingleDebug()) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.single_debug_not_support');
        }
        $node->setNodeId(Code::MagicFlowNode->gen());
        $node->setName("{$node->getNodeTypeName()}_single_debug");
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();

        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($authorization->getId(), $authorization->getId())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [],
            globalVariable: ComponentFactory::fastCreate($triggerConfig['global_variable'] ?? []),
        );

        $operator = $this->createExecutionOperator($authorization);
        $operator->setSourceId('single_debug');
        $conversationId = ConversationId::SingleDebugNode->gen($authorization->getId() . '_' . $node->getNodeId());
        $executionData = new ExecutionData(
            flowDataIsolation: $this->createFlowDataIsolation($authorization),
            operator: $operator,
            triggerType: TriggerType::None,
            triggerData: $triggerData,
            conversationId: $conversationId,
            executionType: ExecutionType::Debug,
        );
        $executionData->setFlowCode('single_debug');
        // 计算 trigger_config 中的 node_contexts
        $nodeContextsComponent = ComponentFactory::fastCreate($triggerConfig['node_contexts'] ?? []);
        if ($nodeContextsComponent?->isForm()) {
            $nodeContextsResult = $nodeContextsComponent->getForm()->getKeyValue();
            if (is_array($nodeContextsResult)) {
                $nodeContextsResult = un_flatten_array($nodeContextsResult);
                foreach ($nodeContextsResult as $nodeId => $nodeContext) {
                    $nodeContexts[$nodeId] = $nodeContext;
                }
            }
        }
        foreach ($nodeContexts as $nodeId => $nodeContext) {
            if (is_array($nodeContext)) {
                $executionData->saveNodeContext((string) $nodeId, $nodeContext);
            }
        }
        $node->getNodeDebugResult()->setThrowException(false);

        $runner->execute($vertexResult, $executionData, ['isThrowException' => false]);

        return $node->getNodeDebugResult();
    }

    /**
     * 保存基本信息.
     */
    #[Transactional]
    public function save(Authenticatable $authorization, MagicFlowEntity $magicFlowEntity): MagicFlowEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);

        $shouldCreate = $magicFlowEntity->shouldCreate();

        $operation = Operation::Owner;
        if (! $shouldCreate) {
            $operation = $this->getFlowOperation($dataIsolation, $magicFlowEntity);
            $operation->validate('edit', $magicFlowEntity->getCode());
        }

        $flow = $this->magicFlowDomainService->save($dataIsolation, $magicFlowEntity);
        $flow->setUserOperation($operation->value);
        return $flow;
    }

    /**
     * 保存节点.
     */
    public function saveNode(Authenticatable $authorization, MagicFlowEntity $magicFlowEntity): MagicFlowEntity
    {
        return $this->magicFlowDomainService->saveNode($this->createFlowDataIsolation($authorization), $magicFlowEntity);
    }

    /**
     * 查询流程.
     * @return array{total: int, list: array<MagicFlowEntity>, users: array<string, MagicUserEntity>, icons: array<string, FileLink>}
     */
    public function queries(Authenticatable $authorization, MagicFLowQuery $query, Page $page): array
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        switch (Type::tryFrom($query->getType())) {
            case Type::Main:
                // 不支持主流程的查询
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_support', ['label' => 'type']);
                // no break
            case Type::Sub:
                // 仅获取具有权限的子流程
                $subResources = $this->operationPermissionAppService->getResourceOperationByUserIds(
                    $permissionDataIsolation,
                    ResourceType::SubFlowCode,
                    [$authorization->getId()]
                )[$authorization->getId()] ?? [];
                $resourceIds = array_keys($subResources);

                $query->setCodes($resourceIds);
                $query->setSelect(['id', 'code', 'name', 'description', 'icon', 'type', 'tool_set_id', 'enabled', 'version_code', 'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at']);
                break;
            case Type::Tools:
                // 需要具有该工具集的读权限
                if (empty($query->getToolSetId())) {
                    break;
                    //                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'tool_set_id']);
                }
                $toolSetOperation = $this->operationPermissionAppService->getOperationByResourceAndUser(
                    $permissionDataIsolation,
                    ResourceType::ToolSet,
                    $query->getToolSetId(),
                    $authorization->getId()
                );
                if (! $toolSetOperation->canRead()) {
                    ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'common.access', ['label' => $query->getToolSetId()]);
                }
                break;
            default:
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'type']);
        }

        $result = $this->magicFlowDomainService->queries($dataIsolation, $query, $page);
        $userIds = [];
        $filePaths = [];
        foreach ($result['list'] as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
            $filePaths[] = $item->getIcon();
            switch ($item->getType()) {
                case Type::Main:
                    $item->setUserOperation(Operation::None->value);
                    break;
                case Type::Sub:
                    if (! isset($subResources)) {
                        $subResources = [];
                    }
                    $operation = $subResources[$item->getCode()] ?? Operation::None;
                    $item->setUserOperation($operation->value);
                    break;
                case Type::Tools:
                    if (! isset($toolSetOperation)) {
                        $toolSetOperation = Operation::Admin;
                    }
                    $item->setUserOperation($toolSetOperation->value);
                    break;
                default:
            }
        }

        $result['users'] = $this->magicUserDomainService->getByUserIds(
            ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
            $userIds
        );
        $result['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $filePaths);
        return $result;
    }

    /**
     * 查询工具.
     * @return array{total: int, list: array<MagicFlowEntity>}
     */
    public function queryTools(Authenticatable $authorization, MagicFLowQuery $query): array
    {
        $page = Page::createNoPage();
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $query->setType(Type::Tools->value);
        // 一定是指定查询的工具 codes
        if (empty($query->getCodes())) {
            return ['total' => 0, 'list' => []];
        }

        $toolSetResources = $this->operationPermissionAppService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            [$authorization->getId()]
        )[$authorization->getId()] ?? [];
        $toolSetIds = array_keys($toolSetResources);

        // 再过滤一下启用的工具集
        $toolSetQuery = new MagicFlowToolSetQuery();
        $toolSetQuery->setCodes($toolSetIds);
        $toolSetQuery->setEnabled(true);
        $toolSetData = $this->magicFlowToolSetDomainService->queries($dataIsolation, $toolSetQuery, $page);
        $toolSetIds = [];
        foreach ($toolSetData['list'] as $toolSet) {
            $toolSetIds[] = $toolSet->getCode();
        }

        $query->setToolSetIds($toolSetIds);
        $query->setEnabled(true);
        $data = $this->magicFlowDomainService->queries($dataIsolation, $query, $page);

        // 增加系统内置工具
        foreach (BuiltInToolSetCollector::list() as $builtInToolSet) {
            foreach ($builtInToolSet->getTools() as $builtInTool) {
                if ($builtInTool->isShow() && in_array($builtInTool->getCode(), $query->getCodes())) {
                    $data['list'][] = $builtInTool->generateToolFlow($dataIsolation->getCurrentOrganizationCode());
                }
            }
        }
        $data['total'] = count($data['list']);
        return $data;
    }

    /**
     * @return array{total: int, list: array<MagicFlowToolSetEntity>, icons: array<string, FileLink>, users: array<string, MagicUserEntity>}
     */
    public function queryToolSets(Authenticatable $authorization, bool $withBuiltInTools = true, bool $withIcons = true): array
    {
        /** @var MagicUserAuthorization $authorization */
        $page = Page::createNoPage();
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);

        $toolSetQuery = new MagicFlowToolSetQuery();
        $toolSetQuery->setEnabled(true);
        $toolQuery = new MagicFLowQuery();
        $toolQuery->setType(Type::Tools->value);
        $toolQuery->setEnabled(true);

        $toolSetResources = $this->operationPermissionAppService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            [$authorization->getId()]
        )[$authorization->getId()] ?? [];
        $toolSetIds = array_keys($toolSetResources);

        $toolSetQuery->setCodes($toolSetIds);
        $toolSetQuery->setOrder(['updated_at' => 'desc']);
        $toolSetData = $this->magicFlowToolSetDomainService->queries($dataIsolation, $toolSetQuery, $page);

        // 增加系统内置工具集
        $builtInTools = [];
        if ($withBuiltInTools) {
            foreach (BuiltInToolSetCollector::list() as $builtInToolSet) {
                $toolSetData['list'][] = $builtInToolSet->generateToolSet();
                foreach ($builtInToolSet->getTools() as $builtInTool) {
                    // 私有工具，需要有高级图像转换URI权限才能显示
                    if ($builtInTool->getCode() === 'ai_image_image_convert_high'
                        && ! PermissionChecker::mobileHasPermission($authorization->getMobile(), SuperPermissionEnum::FLOW_ADMIN)
                    ) {
                        continue;
                    }
                    if ($builtInTool->isShow()) {
                        $builtInTools[] = $builtInTool;
                    }
                }
            }
        }

        $toolSetIds = [];
        $iconPaths = [];
        $userIds = [];
        foreach ($toolSetData['list'] as $index => $toolSet) {
            $toolSetIds[$index] = $toolSet->getCode();
            $iconPaths[] = $toolSet->getIcon();
            $userIds[] = $toolSet->getCreator();
            $userIds[] = $toolSet->getModifier();
            $toolSet->setUserOperation(($toolSetResources[$toolSet->getCode()] ?? Operation::Read)->value);
        }

        $toolQuery->setToolSetIds(array_values($toolSetIds));

        $toolQuery->setSelect(['id', 'code', 'version_code', 'name', 'description', 'type', 'tool_set_id', 'enabled', 'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at']);
        $toolQuery->setOrder(['updated_at' => 'desc']);
        $toolResult = $this->magicFlowDomainService->queries($dataIsolation, $toolQuery, $page);

        // 增加系统内置工具
        /** @var BuiltInToolInterface $builtInTool */
        foreach ($builtInTools as $builtInTool) {
            $toolResult['list'][] = $builtInTool->generateToolFlow($dataIsolation->getCurrentOrganizationCode());
        }

        // 挂载到工具上面
        foreach ($toolResult['list'] as $tool) {
            $index = array_search($tool->getToolSetId(), $toolSetIds);
            if ($index === false) {
                continue;
            }
            $toolInfo = [
                'code' => $tool->getCode(),
                'version_code' => $tool->getVersionCode(),
                'name' => $tool->getName(),
                'description' => $tool->getDescription(),
            ];
            $toolSetData['list'][$index]->addTool($toolInfo);
        }

        // 过滤掉没有任何工具的工具集
        $toolSetData['list'] = array_filter($toolSetData['list'], fn (MagicFlowToolSetEntity $toolSet) => ! empty($toolSet->getTools()));
        $toolSetData['total'] = count($toolSetData['list']);

        $toolSetData['icons'] = $withIcons ? $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $iconPaths) : [];
        //        $toolSetData['users'] = $this->magicUserDomainService->getByUserIds(
        //            ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
        //            $userIds
        //        );
        $toolSetData['users'] = [];

        return $toolSetData;
    }

    /**
     * @return array{total: int, list: array<KnowledgeBaseEntity>, users: array<MagicUserEntity>}
     */
    public function queryKnowledge(Authenticatable $authorization): array
    {
        $page = Page::createNoPage();
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);

        $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::Knowledge,
            [$authorization->getId()]
        )[$authorization->getId()] ?? [];

        $query = new KnowledgeBaseQuery();
        $query->setCodes(array_keys($resources));
        // 目前仅获取自建文本的知识库
        $query->setTypes([KnowledgeType::UserKnowledgeBase->value]);
        $query->setEnabled(true);
        $knowledgeData = $this->magicFlowKnowledgeDomainService->queries($this->createKnowledgeBaseDataIsolation($dataIsolation), $query, $page);

        $userTopicKnowledge = KnowledgeBaseEntity::createCurrentTopicTemplate($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        $userConversationKnowledge = KnowledgeBaseEntity::createConversationTemplate($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        $knowledgeData['list'] = array_merge([$userTopicKnowledge, $userConversationKnowledge], $knowledgeData['list']);

        $userIds = [];
        foreach ($knowledgeData['list'] as $knowledge) {
            $userIds[] = $knowledge->getCreator();
            $userIds[] = $knowledge->getModifier();
            if ($knowledge->getCode() === ConstValue::KNOWLEDGE_USER_CURRENT_TOPIC) {
                $knowledge->setUserOperation(Operation::Owner->value);
            } else {
                $knowledge->setUserOperation(($resources[$knowledge->getCode()] ?? Operation::None)->value);
            }
            $knowledge->setSourceType($this->knowledgeBaseStrategy->getOrCreateDefaultSourceType($knowledge));
        }
        $knowledgeData['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolation($dataIsolation), $userIds);

        // 重新计算总数
        $knowledgeData['total'] = count($knowledgeData['list']);

        return $knowledgeData;
    }

    /**
     * 获取流程.
     */
    public function getByCode(Authenticatable $authorization, string $flowId): MagicFlowEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $magicFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $flowId);
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $flowId]);
        }
        $operation = $this->getFlowOperation($dataIsolation, $magicFlow)->validate('read', $flowId);
        $magicFlow->setUserOperation($operation->value);
        return $magicFlow;
    }

    /**
     * 修改启用状态.
     */
    #[Transactional]
    public function changeEnable(Authenticatable $authorization, string $flowId, ?bool $enable = null): void
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $magicFlow = $this->magicFlowDomainService->getByCode($this->createFlowDataIsolation($authorization), $flowId);
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $flowId]);
        }
        $this->getFlowOperation($dataIsolation, $magicFlow)->validate('edit', $flowId);

        $this->magicFlowDomainService->changeEnable($dataIsolation, $magicFlow, $enable);
        AsyncEventUtil::dispatch(new MagicFlowChangeEnabledEvent($magicFlow));
    }

    /**
     * 删除流程.
     */
    public function remove(Authenticatable $authorization, string $flowId): void
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);

        $magicFlow = $this->magicFlowDomainService->getByCode($this->createFlowDataIsolation($authorization), $flowId);
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $flowId]);
        }

        $this->getFlowOperation($dataIsolation, $magicFlow)->validate('delete', $flowId);

        $this->magicFlowDomainService->destroy($dataIsolation, $magicFlow);
    }

    public function expressionDataSource(): array
    {
        $expressionDataSource = new ExpressionDataSource(true);
        return [
            'expression_data_source' => $expressionDataSource->toArray(),
        ];
    }
}
