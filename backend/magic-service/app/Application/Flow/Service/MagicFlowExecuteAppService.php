<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Application\Flow\ExecuteManager\Attachment\AttachmentUtil;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\ExecutionData\Operator;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Application\Flow\ExecuteManager\Stream\FlowEventStreamManager;
use App\Application\Kernel\EnvManager;
use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\DTO\Agent\SenderExtraDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\ChatInstruction;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\InstructionType;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Domain\Flow\Entity\MagicFlowVersionEntity;
use App\Domain\Flow\Entity\ValueObject\ConversationId;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\ErrorCode\FlowErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Collector\BuiltInToolSet\BuiltInToolSetCollector;
use App\Infrastructure\Core\Contract\Authorization\FlowOpenApiCheckInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use DateTime;
use Dtyq\FlowExprEngine\ComponentFactory;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowExecuteAppService extends AbstractFlowAppService
{
    public function imChat(string $flowId, TriggerType $triggerType, array $senderEntities = []): void
    {
        $senderUserEntity = $senderEntities['sender'] ?? null;
        $senderAccountEntity = $senderEntities['sender_account'] ?? null;
        if (! $senderUserEntity instanceof MagicUserEntity) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'sender_user_not_found');
        }
        $seqEntity = $senderEntities['seq'] ?? null;
        if (! $seqEntity instanceof MagicSeqEntity) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'sender_seq_not_found');
        }
        $messageEntity = $senderEntities['message'] ?? null;
        if (! $messageEntity instanceof MagicMessageEntity && ! $seqEntity->canTriggerFlow()) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'sender_message_not_found');
        }

        $envId = 0;
        $senderExtra = $senderEntities['sender_extra'] ?? null;
        if ($senderExtra instanceof SenderExtraDTO) {
            $envId = $senderExtra->getMagicEnvId() ?? 0;
        }

        $authorization = new MagicUserAuthorization();
        $authorization
            ->setId($senderUserEntity->getUserId())
            ->setOrganizationCode($senderUserEntity->getOrganizationCode())
            ->setUserType($senderUserEntity->getUserType())
            ->setMagicEnvId($envId);

        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $flowData = $this->getFlow($dataIsolation, $flowId, [Type::Main]);
        $magicFlow = $flowData['flow'];

        $triggerData = new TriggerData(
            triggerTime: new DateTime($messageEntity?->getSendTime() ?? $seqEntity->getCreatedAt()),
            userInfo: ['user_entity' => $senderUserEntity, 'account_entity' => $senderAccountEntity],
            messageInfo: ['message_entity' => $messageEntity, 'seq_entity' => $seqEntity],
            globalVariable: $magicFlow->getGlobalVariable(),
            isIgnoreMessageEntity: $seqEntity->canTriggerFlow(),
        );
        $operator = $this->createExecutionOperator($authorization);
        $operator->setSourceId('im_chat');
        $executionData = new ExecutionData(
            flowDataIsolation: $dataIsolation,
            operator: $operator,
            triggerType: $triggerType,
            triggerData: $triggerData,
            conversationId: ConversationId::ImChat->gen($magicFlow->getCode() . '-' . $seqEntity->getConversationId()),
            originConversationId: $seqEntity->getConversationId(),
            executionType: ExecutionType::IMChat,
        );

        // 如果是 对话，强制开启 stream 模式
        if ($triggerType === TriggerType::ChatMessage) {
            $executionData->setStream(true);
        }

        $executionData->setSenderEntities($senderUserEntity, $seqEntity, $messageEntity);
        $executionData->setTopicId($seqEntity->getExtra()?->getTopicId());
        $executionData->setAgentId($magicFlow->getAgentId());
        if ($flowData['agent_version']) {
            $executionData->setInstructionConfigs($flowData['agent_version']->getInstructs());
        }
        $executor = new MagicFlowExecutor($magicFlow, $executionData);
        $executor->execute();

        // 如果有节点执行失败，抛出异常
        foreach ($magicFlow->getNodes() as $node) {
            $nodeDebugResult = $node->getNodeDebugResult();
            if ($nodeDebugResult && ! $nodeDebugResult->isSuccess()) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, $nodeDebugResult->getErrorMessage());
            }
        }
    }

    public function apiChat(MagicFlowApiChatDTO $apiChatDTO): array
    {
        $apiChatDTO->validate();
        $authorization = di(FlowOpenApiCheckInterface::class)->handle($apiChatDTO);

        $flowDataIsolation = $this->createFlowDataIsolation($authorization);
        $operator = $this->createExecutionOperator($flowDataIsolation);

        $user = $apiChatDTO->getShareOptions('user');
        if (! $user instanceof MagicUserEntity) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'user not found');
        }
        $account = $this->magicAccountDomainService->getByMagicId($user->getMagicId());
        $operator->setRealName($account?->getRealName());
        $operator->setSourceId($apiChatDTO->getShareOptions('source_id', 'sk_flow'));

        $flowData = $this->getFlow($flowDataIsolation, $apiChatDTO->getFlowCode(), [Type::Main]);
        $magicFlow = $flowData['flow'];

        // 设置指令
        $messageEntity = new TextMessage(['content' => $apiChatDTO->getMessage()]);
        if (! empty($apiChatDTO->getInstruction())) {
            $msgInstruct = $this->generateChatInstruction($apiChatDTO);
            $messageEntity->setInstructs($msgInstruct);
        }
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => $user, 'account_entity' => $account],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity($messageEntity)],
            globalVariable: $magicFlow->getGlobalVariable(),
            attachments: AttachmentUtil::getByApiArray($apiChatDTO->getAttachments()),
        );
        $originConversationId = $apiChatDTO->getConversationId();
        $executionData = new ExecutionData(
            flowDataIsolation: $flowDataIsolation,
            operator: $operator,
            triggerType: TriggerType::ChatMessage,
            triggerData: $triggerData,
            conversationId: ConversationId::ApiKeyChat->gen($originConversationId),
            originConversationId: $originConversationId,
            executionType: ExecutionType::SKApi,
        );
        $executionData->setAgentId($magicFlow->getAgentId());
        if ($flowData['agent_version']) {
            $executionData->setInstructionConfigs($flowData['agent_version']->getInstructs());
        }
        $executionData->setStream($apiChatDTO->isStream(), $apiChatDTO->getVersion());
        $executor = new MagicFlowExecutor($magicFlow, $executionData, async: $apiChatDTO->isAsync());
        if ($apiChatDTO->isStream()) {
            FlowEventStreamManager::get();
        }
        $executor->execute();
        if ($apiChatDTO->isAsync()) {
            return [
                'conversation_id' => $executionData->getOriginConversationId(),
                'task_id' => $executor->getExecutorId(),
            ];
        }

        return [
            'messages' => $executionData->getReplyMessagesArray(),
            'conversation_id' => $executionData->getOriginConversationId(),
        ];
    }

    public function apiParamCall(MagicFlowApiChatDTO $apiChatDTO): array
    {
        $apiChatDTO->validate(false);
        $authorization = di(FlowOpenApiCheckInterface::class)->handle($apiChatDTO);

        $flowDataIsolation = $this->createFlowDataIsolation($authorization);
        $operator = $this->createExecutionOperator($flowDataIsolation);

        $user = $apiChatDTO->getShareOptions('user');
        if (! $user instanceof MagicUserEntity) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'user not found');
        }
        $account = $this->magicAccountDomainService->getByMagicId($user->getMagicId());
        $operator->setRealName($account?->getRealName());
        $operator->setSourceId($apiChatDTO->getShareOptions('source_id', 'sk_flow'));

        $operationValidate = 'read';
        if ($apiChatDTO->getShareOptions('source_id') === 'oauth2_flow') {
            $operationValidate = '';
        }
        $flowData = $this->getFlow($flowDataIsolation, $apiChatDTO->getFlowCode(), [Type::Sub, Type::Tools], operationValidate: $operationValidate);
        $magicFlow = $flowData['flow'];

        // 设置指令
        $messageEntity = new TextMessage(['content' => $apiChatDTO->getMessage()]);

        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => $user, 'account_entity' => $account],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity($messageEntity)],
            params: $apiChatDTO->getParams(),
            globalVariable: $magicFlow->getGlobalVariable(),
            attachments: AttachmentUtil::getByApiArray($apiChatDTO->getAttachments()),
        );
        $originConversationId = $apiChatDTO->getConversationId();
        $executionData = new ExecutionData(
            flowDataIsolation: $flowDataIsolation,
            operator: $operator,
            triggerType: TriggerType::ParamCall,
            triggerData: $triggerData,
            conversationId: ConversationId::ApiKeyChat->gen($originConversationId),
            originConversationId: $originConversationId,
            executionType: ExecutionType::SKApi,
        );
        $executor = new MagicFlowExecutor($magicFlow, $executionData, async: $apiChatDTO->isAsync());
        $executor->execute();
        if ($apiChatDTO->isAsync()) {
            return [
                'conversation_id' => $executionData->getOriginConversationId(),
                'task_id' => $executor->getExecutorId(),
            ];
        }

        return [
            'conversation_id' => $executionData->getOriginConversationId(),
            'result' => $magicFlow->getResult(),
        ];
    }

    public function apiChatByMCPTool(FlowDataIsolation $flowDataIsolation, MagicFlowApiChatDTO $apiChatDTO): array
    {
        $user = $this->magicUserDomainService->getByUserId($flowDataIsolation->getCurrentUserId());
        if (! $user) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'user not found');
        }
        $account = $this->magicAccountDomainService->getByMagicId($user->getMagicId());
        if (! $account) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'account not found');
        }
        EnvManager::initDataIsolationEnv($flowDataIsolation, force: true);
        $operator = $this->createExecutionOperator($flowDataIsolation);
        $operator->setSourceId('mcp_tool');

        $flowData = $this->getFlow(
            $flowDataIsolation,
            $apiChatDTO->getFlowCode(),
            [Type::Main],
        );
        $magicFlow = $flowData['flow'];

        // Set instruction for chat scenario
        $messageEntity = new TextMessage(['content' => $apiChatDTO->getMessage()]);
        if (! empty($apiChatDTO->getInstruction())) {
            $msgInstruct = $this->generateChatInstruction($apiChatDTO);
            $messageEntity->setInstructs($msgInstruct);
        }

        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => $user, 'account_entity' => $account],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity($messageEntity)],
            params: $apiChatDTO->getParams(),
            globalVariable: $magicFlow->getGlobalVariable(),
            attachments: AttachmentUtil::getByApiArray($apiChatDTO->getAttachments()),
        );
        $originConversationId = $apiChatDTO->getConversationId() ?: IdGenerator::getUniqueId32();
        $executionData = new ExecutionData(
            flowDataIsolation: $flowDataIsolation,
            operator: $operator,
            triggerType: TriggerType::ChatMessage,
            triggerData: $triggerData,
            conversationId: ConversationId::ApiKeyChat->gen($originConversationId),
            originConversationId: $originConversationId,
            executionType: ExecutionType::SKApi,
        );
        $executionData->setAgentId($magicFlow->getAgentId());
        if ($flowData['agent_version']) {
            $executionData->setInstructionConfigs($flowData['agent_version']->getInstructs());
        }
        $executor = new MagicFlowExecutor($magicFlow, $executionData);
        $executor->execute();

        return [
            'messages' => $executionData->getReplyMessagesArray(),
            'conversation_id' => $executionData->getOriginConversationId(),
        ];
    }

    public function apiParamCallByRemoteTool(FlowDataIsolation $flowDataIsolation, MagicFlowApiChatDTO $apiChatDTO, string $sourceId = ''): array
    {
        $user = $this->magicUserDomainService->getByUserId($flowDataIsolation->getCurrentUserId());
        if (! $user) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'user not found');
        }
        EnvManager::initDataIsolationEnv($flowDataIsolation, force: true);
        $account = $this->magicAccountDomainService->getByMagicId($user->getMagicId());
        if (! $account) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'account not found');
        }
        $operator = $this->createExecutionOperator($flowDataIsolation);
        $operator->setSourceId($sourceId);

        $flowData = $this->getFlow(
            $flowDataIsolation,
            $apiChatDTO->getFlowCode(),
            [Type::Tools],
            operationValidate: 'read',
            flowVersionCode: $apiChatDTO->getFlowVersionCode()
        );
        $magicFlow = $flowData['flow'];

        $messageEntity = new TextMessage(['content' => $apiChatDTO->getMessage()]);

        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => $user, 'account_entity' => $account],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity($messageEntity)],
            params: $apiChatDTO->getParams(),
            globalVariable: $magicFlow->getGlobalVariable(),
            attachments: AttachmentUtil::getByApiArray($apiChatDTO->getAttachments()),
        );
        $originConversationId = $apiChatDTO->getConversationId() ?: IdGenerator::getUniqueId32();
        $executionData = new ExecutionData(
            flowDataIsolation: $flowDataIsolation,
            operator: $operator,
            triggerType: TriggerType::ParamCall,
            triggerData: $triggerData,
            conversationId: ConversationId::ApiKeyChat->gen($originConversationId),
            originConversationId: $originConversationId,
            executionType: ExecutionType::SKApi,
        );
        $executor = new MagicFlowExecutor($magicFlow, $executionData);
        $executor->execute();
        return [
            'result' => $magicFlow->getResult(),
        ];
    }

    public function getByExecuteId(MagicFlowApiChatDTO $apiChatDTO): MagicFlowExecuteLogEntity
    {
        $apiChatDTO->validate();
        if (empty($apiChatDTO->getTaskId())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'task_id is required');
        }
        $authorization = di(FlowOpenApiCheckInterface::class)->handle($apiChatDTO);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $log = $this->magicFlowExecuteLogDomainService->getByExecuteId($flowDataIsolation, $apiChatDTO->getTaskId());
        if (! $log) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $apiChatDTO->getTaskId()]);
        }
        // 只能查询第一层的数据
        if (! $log->isTop()) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $apiChatDTO->getTaskId()]);
        }

        // 检查是否具有该流程的权限
        $this->getFlow($flowDataIsolation, $log->getFlowCode(), operationValidate: 'read');

        return $log;
    }

    /**
     * 定时任务触发.
     */
    public static function routine(string $flowCode, string $branchId, array $routineConfig = []): void
    {
        // 暂时只有系统级别的定时任务
        $dataIsolation = FlowDataIsolation::create();
        $magicFlow = di(MagicFlowDomainService::class)->getByCode($dataIsolation, $flowCode);
        if (! $magicFlow) {
            return;
        }
        $dataIsolation->setCurrentOrganizationCode($magicFlow->getOrganizationCode());
        $dataIsolation->setCurrentUserId($magicFlow->getCreator());
        EnvManager::initDataIsolationEnv($dataIsolation);

        $datetime = new DateTime();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity('system', 'routine', '')],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [
                'trigger_time' => $datetime->format('Y-m-d H:i:s'),
                'trigger_timestamp' => $datetime->getTimestamp(),
                'branch_id' => $branchId,
                'routine_config' => $routineConfig,
            ],
            globalVariable: $magicFlow->getGlobalVariable(),
        );

        $operator = Operator::createByCrontab($magicFlow->getOrganizationCode());
        $operator->setSourceId('routine');
        $executionData = new ExecutionData(
            flowDataIsolation: $dataIsolation,
            operator: $operator,
            triggerType: TriggerType::Routine,
            triggerData: $triggerData,
            conversationId: ConversationId::Routine->gen($magicFlow->getCode() . '_routine'),
            executionType: ExecutionType::Routine,
        );
        if ($magicFlow->getType()->isMain()) {
            $agent = di(MagicAgentDomainService::class)->getByFlowCode($magicFlow->getCode());
            if ($agent) {
                $executionData->setAgentId($agent->getId());
                $magicFlow->setAgentId($agent->getId());
            }
        }
        $executor = new MagicFlowExecutor($magicFlow, $executionData);

        $executor->execute();

        // 检查错误
        foreach ($magicFlow->getNodes() as $node) {
            $nodeDebugResult = $node->getNodeDebugResult();
            if ($nodeDebugResult && ! $nodeDebugResult->isSuccess()) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, $nodeDebugResult->getErrorMessage());
            }
        }
    }

    /**
     * 试运行.
     */
    public function testRun(Authenticatable $authorization, MagicFlowEntity $magicFlowEntity, array $triggerConfig): array
    {
        // 获取助理信息
        if ($magicFlowEntity->getType() == Type::Main) {
            $magicAgentEntity = $this->magicAgentDomainService->getByFlowCode($magicFlowEntity->getCode());
            $magicFlowEntity->setAgentId($magicAgentEntity->getId());
        }

        $triggerType = TriggerType::tryFrom($triggerConfig['trigger_type'] ?? 0);
        if ($triggerType === null) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => 'trigger_type']);
        }
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);
        $magicFlowEntity->setOrganizationCode($flowDataIsolation->getCurrentOrganizationCode());

        $result = [
            'success' => true,
            'key' => '',
            'node_debug' => [],
        ];

        if (! empty($triggerConfig['trigger_data']['chat_time']) && strtotime($triggerConfig['trigger_data']['chat_time'])) {
            $triggerTime = new DateTime($triggerConfig['trigger_data']['chat_time']);
        } else {
            $triggerTime = new DateTime();
        }
        $nickname = $triggerConfig['trigger_data']['nickname'] ?? null;
        if (! $nickname && $authorization instanceof MagicUserAuthorization) {
            $nickname = $authorization->getNickname();
        }
        $operator = $this->createExecutionOperator($authorization);
        $operator->setSourceId('test_run');

        $triggerData = new TriggerData(
            triggerTime: $triggerTime,
            userInfo: ['user_entity' => TriggerData::createUserEntity($authorization->getId(), $nickname ?? $authorization->getId(), $operator->getOrganizationCode())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => $triggerConfig['trigger_data']['content'] ?? '']))],
            params: $triggerConfig['trigger_data'] ?? [],
            paramsForm: $triggerConfig['trigger_data_form'] ?? [],
            // 试运行时，全局变量为手动传入
            globalVariable: ComponentFactory::fastCreate($triggerConfig['global_variable'] ?? []) ?? $magicFlowEntity->getGlobalVariable(),
            attachments: AttachmentUtil::getByApiArray($triggerConfig['trigger_data']['files'] ?? []),
        );

        $magicFlowEntity->prepareTestRun();
        $magicFlowEntity->setCreator($flowDataIsolation->getCurrentUserId());

        $originConversationId = $triggerConfig['conversation_id'] ?? IdGenerator::getUniqueId32();
        $topicId = $triggerConfig['topic_id'] ?? '';
        $executionData = new ExecutionData(
            flowDataIsolation: $flowDataIsolation,
            operator: $operator,
            triggerType: $triggerType,
            triggerData: $triggerData,
            conversationId: ConversationId::DebugFlow->gen($operator->getUid() . '_tr_' . $originConversationId),
            originConversationId: $originConversationId,
            executionType: ExecutionType::Debug,
        );
        $executionData->setTopicId($topicId);
        $executionData->setAgentId($magicFlowEntity->getAgentId());
        $executionData->setDebug((bool) ($triggerConfig['debug'] ?? false));
        // 运行流程图，检测是否可以运行
        $executor = new MagicFlowExecutor($magicFlowEntity, $executionData);
        $executor->execute();

        // 获取 node 运行结果
        foreach ($magicFlowEntity->getNodes() as $node) {
            if ($node->getNodeDebugResult()) {
                // 有一个失败就判定为失败
                if (! $node->getNodeDebugResult()->isSuccess()) {
                    $result['success'] = false;
                }
                $result['node_debug'][$node->getNodeId()] = $node->getNodeDebugResult()->toArray();
            }
        }
        return $result;
    }

    /**
     * @return ChatInstruction[]
     */
    private function generateChatInstruction(MagicFlowApiChatDTO $apiChatDTO): array
    {
        $msgInstruct = [];
        foreach ($apiChatDTO->getInstruction() as $instruction) {
            $msgInstruct[] = new ChatInstruction([
                'value' => $instruction->getValue(),
                'instruction' => [
                    'id' => $instruction->getId(),
                    'name' => $instruction->getName(),
                    'instruction_type' => InstructionType::Flow->value,
                ],
            ]);
        }
        return $msgInstruct;
    }

    /**
     * 获取流程信息.
     *
     * @return array{flow: MagicFlowEntity, flow_version?: ?MagicFlowVersionEntity, agent?: ?MagicAgentEntity, agent_version?: ?MagicAgentVersionEntity}
     */
    private function getFlow(FlowDataIsolation $dataIsolation, string $flowId, ?array $types = null, string $operationValidate = '', string $flowVersionCode = ''): array
    {
        if ($tool = BuiltInToolSetCollector::getToolByCode($flowId)) {
            $flow = $tool->generateToolFlow($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
            return [
                'flow' => $flow,
                'flow_version' => null,
                'agent' => null,
                'agent_version' => null,
            ];
        }

        $magicFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $flowId);
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $flowId]);
        }
        if (! is_null($types) && ! in_array($magicFlow->getType(), $types)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.executor.unsupported_flow_type');
        }

        $flowVersion = null;
        $agent = null;
        $agentVersion = null;
        $agentId = '';
        switch ($magicFlow->getType()) {
            case Type::Main:
                $agent = $this->magicAgentDomainService->getByFlowCode($magicFlow->getCode());
                // 仅允许创建人可以在禁用状态下调用
                if ($agent->getCreatedUid() !== $dataIsolation->getCurrentUserId() && ! $agent->isAvailable()) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.agent_disabled');
                }
                $agentVersion = $agent;
                if ($agent->getAgentVersionId()) {
                    $agentVersion = $this->magicAgentVersionDomainService->getById($agent->getAgentVersionId());
                    $flowVersionCode = $agentVersion->getFlowVersion();
                }
                $agentId = $agent->getId();
                break;
            case Type::Sub:
            case Type::Tools:
                if (! $magicFlow->isEnabled()) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.flow_disabled');
                }
                break;
            default:
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.executor.unsupported_flow_type');
        }

        if (! empty($flowVersionCode)) {
            $flowVersion = $this->magicFlowVersionDomainService->show($dataIsolation, $flowId, $flowVersionCode);
            $magicFlow = $flowVersion->getMagicFlow();
            $magicFlow->setVersionCode($flowVersion->getCode());
        }
        $magicFlow->setAgentId((string) $agentId);

        if ($operationValidate) {
            $this->getFlowOperation($dataIsolation, $magicFlow)->validate($operationValidate, $flowId);
        }

        return [
            'flow' => $magicFlow,
            'flow_version' => $flowVersion,
            'agent' => $agent,
            'agent_version' => $agentVersion,
        ];
    }
}
