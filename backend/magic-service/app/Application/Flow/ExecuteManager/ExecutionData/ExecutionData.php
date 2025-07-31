<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Attachment\Attachment;
use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\Message;
use App\Domain\Agent\Entity\ValueObject\ThirdPlatformChat\ThirdPlatformChatType;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\InstructionConfig;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use JetBrains\PhpStorm\ArrayShape;

class ExecutionData
{
    private string $id;

    private ExecutionType $executionType;

    private TriggerType $triggerType;

    private ?TriggerData $triggerData;

    private string $agentId = '';

    private ?string $agentUserId = null;

    private string $flowCode = '';

    private string $flowVersion = '';

    private string $flowCreator = '';

    private string $parentFlowCode = '';

    /**
     * 节点上下文.
     * @var array {nodeId: {context}}
     */
    private array $nodeContext = [];

    /**
     * 节点执行次数.
     */
    private array $executeNum = [];

    private array $nodeVertexResult = [];

    /**
     * 变量.
     */
    private array $variables = [];

    /**
     * 附件。流程执行时产生的所有文件记录.
     * @var array<string, AbstractAttachment>
     */
    private array $attachmentRecords = [];

    /**
     * 真实会话ID.
     */
    private string $conversationId;

    /**
     * 原始会话ID.
     */
    private string $originConversationId = '';

    /**
     * 话题ID.
     */
    private ?string $topicId = null;

    /**
     * 用作传递一些特殊的参数，预留.
     */
    private array $ext = [];

    /**
     * 当前操作人.
     */
    private Operator $operator;

    /**
     * 数据隔离.
     */
    private FlowDataIsolation $dataIsolation;

    /**
     * @var array<Message>
     */
    private array $replyMessages = [];

    private bool $debug = false;

    private bool $stream = false;

    private string $streamVersion = '';

    private FlowStreamStatus $flowStreamStatus = FlowStreamStatus::Pending;

    /**
     * 发送方的冗余信息.
     * $userEntity. 发送方的用户信息.
     * $seqEntity. 发送方的会话窗口信息.
     * $messageEntity. 发送方的消息信息.
     */
    private array $senderEntities = [];

    private int $level = 0;

    private string $uniqueId;

    private string $uniqueParentId = '';

    private ?MagicFlowEntity $magicFlowEntity = null;

    /**
     * 当前 agent 的指令配置列表.
     * @var array<InstructionConfig>
     */
    private array $instructionConfigs = [];

    public function __construct(
        FlowDataIsolation $flowDataIsolation,
        Operator $operator,
        TriggerType $triggerType = TriggerType::None,
        ?TriggerData $triggerData = null,
        ?string $id = null,
        ?string $conversationId = null,
        ?string $originConversationId = null,
        ExecutionType $executionType = ExecutionType::None,
    ) {
        $this->uniqueId = uniqid('', true);
        $this->dataIsolation = $flowDataIsolation;
        $this->operator = $operator;
        $this->executionType = $executionType;
        $this->triggerType = $triggerType;
        $this->triggerData = $triggerData;
        $this->id = $id ?? 'e_' . IdGenerator::getUniqueId32();
        $this->conversationId = $conversationId ?? 'c_' . IdGenerator::getUniqueId32();
        $this->originConversationId = $originConversationId ?? $this->conversationId;
        // 初始化全局变量到变量中
        $this->initGlobalVariable();
    }

    public function extends(ExecutionData $parent): void
    {
        $this->parentFlowCode = $parent->getFlowCode();
        $this->executionType = $parent->getExecutionType();
        $this->originConversationId = $parent->getOriginConversationId();
        $this->topicId = $parent->getTopicId();
        $this->senderEntities = $parent->getSenderEntities();
        $this->agentId = $parent->getAgentId();
        $this->agentUserId = $parent->getAgentUserId();
        $this->dataIsolation = $parent->getDataIsolation();
        $this->stream = $parent->isStream();
        $this->streamVersion = $parent->getStreamVersion();
        $this->flowStreamStatus = $parent->getStreamStatus();
        $this->level = $parent->getLevel() + 1;
        $this->uniqueParentId = $parent->getUniqueId();
    }

    public function isTop(): bool
    {
        return $this->level === 0;
    }

    public function getLevel(): int
    {
        return $this->level;
    }

    public function getExecutionType(): ExecutionType
    {
        return $this->executionType;
    }

    public function setSenderEntities(MagicUserEntity $userEntity, MagicSeqEntity $seqEntity, ?MagicMessageEntity $messageEntity): void
    {
        $this->senderEntities = [
            'user' => $userEntity,
            'seq' => $seqEntity,
            'message' => $messageEntity,
        ];
    }

    #[ArrayShape(['user' => MagicUserEntity::class, 'seq' => MagicSeqEntity::class, 'message' => MagicMessageEntity::class])]
    public function getSenderEntities(): array
    {
        return $this->senderEntities;
    }

    public function saveNodeContext(string $nodeId, ?array $context): void
    {
        $this->nodeContext[$nodeId] = $context;
    }

    public function getNodeContext(string $nodeId): array
    {
        return $this->nodeContext[$nodeId] ?? [];
    }

    public function getAttachmentRecord(string $path): ?AbstractAttachment
    {
        return $this->attachmentRecords[$path] ?? null;
    }

    public function addAttachmentRecord(AbstractAttachment $attachment): void
    {
        $this->attachmentRecords[$attachment->getPath()] = $attachment;
    }

    public function getPersistenceData(): array
    {
        return [
            'node_context' => $this->nodeContext,
            'variables' => $this->variables,
            'attachment_records' => array_map(function (AbstractAttachment $attachment) {
                return $attachment->toArray();
            }, $this->attachmentRecords),
        ];
    }

    public function loadPersistenceData(array $data): void
    {
        $attachmentRecords = [];
        foreach ($data['attachment_records'] ?? [] as $item) {
            if (empty($item['url'])) {
                continue;
            }
            $attachment = new Attachment(
                name: $item['name'] ?? '',
                url: $item['url'],
                ext: $item['ext'] ?? '',
                size: $item['size'] ?? 0,
                chatFileId: $item['chat_file_id'] ?? 0,
            );
            $attachmentRecords[$attachment->getPath()] = $attachment;
        }
        $this->nodeContext = $data['node_context'] ?? [];
        $this->variables = $data['variables'] ?? [];
        $this->attachmentRecords = $attachmentRecords;
    }

    public function all(): array
    {
        return $this->nodeContext + ['variables' => $this->variableList()];
    }

    public function getExpressionFieldData(): array
    {
        return $this->all();
    }

    public function setFlowCode(string $flowCode, string $versionCode = '', string $flowCreator = ''): void
    {
        $this->flowCode = $flowCode;
        $this->flowVersion = $versionCode;
        $this->flowCreator = $flowCreator;
    }

    public function getExecuteNum(string $nodeId): int
    {
        return $this->executeNum[$nodeId] ?? 0;
    }

    public function increaseExecuteNum(string $nodeId, VertexResult $vertexResult, int $step = 1): void
    {
        $num = ($this->executeNum[$nodeId] ?? 0) + $step;
        $this->executeNum[$nodeId] = $num;
        $this->nodeVertexResult[$nodeId][$num] = $vertexResult;
    }

    public function getNodeHistoryVertexResult(string $nodeId, int $executeNum): ?VertexResult
    {
        return $this->nodeVertexResult[$nodeId][$executeNum] ?? null;
    }

    public function isDebug(): bool
    {
        return $this->debug;
    }

    public function setDebug(bool $debug): void
    {
        $this->debug = $debug;
    }

    public function addReplyMessage(Message $message): void
    {
        $this->replyMessages[] = $message;
    }

    /**
     * @return array<Message>
     */
    public function getReplyMessages(): array
    {
        return $this->replyMessages;
    }

    public function getReplyMessagesArray(): array
    {
        $data = [];
        foreach ($this->replyMessages as $message) {
            $data[] = $message->toApiResponse();
        }
        return $data;
    }

    public function variableList(): array
    {
        return $this->variables;
    }

    public function variableSave(string $key, mixed $data): void
    {
        $this->variables[$key] = $data;
    }

    public function variableExists(string $key): bool
    {
        return isset($this->variables[$key]);
    }

    public function variableGet(string $key, mixed $default = null): mixed
    {
        return $this->variables[$key] ?? $default;
    }

    public function variableDestroy(string $key): void
    {
        unset($this->variables[$key]);
    }

    public function variableShift(string $key): mixed
    {
        $array = $this->variables[$key] ?? [];
        if (! is_array($array) || empty($array)) {
            return null;
        }
        return array_shift($this->variables[$key]);
    }

    public function variablePush(string $key, array $data): void
    {
        $oldData = $this->variableGet($key, []);
        if (! is_array($oldData)) {
            return;
        }
        $oldData = array_values($oldData);

        foreach ($data as $item) {
            $oldData[] = $item;
        }

        $this->variableSave($key, $oldData);
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getTriggerType(): TriggerType
    {
        return $this->triggerType;
    }

    public function setTriggerType(TriggerType $triggerType): void
    {
        $this->triggerType = $triggerType;
    }

    public function getFlowVersion(): string
    {
        return $this->flowVersion;
    }

    public function getTriggerData(): ?TriggerData
    {
        return $this->triggerData;
    }

    public function getVariables(): array
    {
        return $this->variables;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getOriginConversationId(): string
    {
        return $this->originConversationId ?: $this->conversationId;
    }

    public function setOriginConversationId(string $originConversationId): void
    {
        $this->originConversationId = $originConversationId;
    }

    public function getTopicId(): ?string
    {
        if (empty($this->topicId)) {
            return null;
        }
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): void
    {
        if (empty($topicId)) {
            $topicId = null;
        }
        $this->topicId = $topicId;
    }

    public function getTopicIdString(): string
    {
        return $this->topicId ?? '';
    }

    public function getExt(): array
    {
        return $this->ext;
    }

    public function getOperator(): Operator
    {
        return $this->operator;
    }

    public function setOperator(Operator $operator): void
    {
        $this->operator = $operator;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function getFlowCreator(): string
    {
        return $this->flowCreator;
    }

    public function getParentFlowCode(): string
    {
        return $this->parentFlowCode;
    }

    public function getDataIsolation(): FlowDataIsolation
    {
        return $this->dataIsolation;
    }

    public function isStream(): bool
    {
        return $this->stream;
    }

    public function setStream(bool $stream, string $streamVersion = 'v0'): void
    {
        $this->stream = $stream;
        $this->streamVersion = $streamVersion;
    }

    public function getStreamVersion(): string
    {
        return $this->streamVersion;
    }

    public function getAgentId(): string
    {
        return $this->agentId ?? '';
    }

    public function setAgentId(string $agentId): void
    {
        $this->agentId = $agentId;
    }

    /**
     * 获取当前 agent 的 user_id.
     */
    public function getAgentUserId(): ?string
    {
        if (! is_null($this->agentUserId)) {
            return $this->agentUserId;
        }
        $flowCode = $this->getFlowCode();
        if (! empty($this->parentFlowCode)) {
            $flowCode = $this->parentFlowCode;
        }
        $flowOrganizationCode = $this->getMagicFlowEntity()?->getOrganizationCode();
        if (empty($flowOrganizationCode)) {
            $flowOrganizationCode = $this->dataIsolation->getCurrentOrganizationCode();
        }
        $contactDataIsolation = ContactDataIsolation::create($flowOrganizationCode, $this->dataIsolation->getCurrentUserId());
        $user = di(MagicUserDomainService::class)->getByAiCode($contactDataIsolation, $flowCode);
        return $user?->getUserId() ?? '';
    }

    /**
     * @return InstructionConfig[]
     */
    public function getInstructionConfigs(): array
    {
        return $this->instructionConfigs;
    }

    public function setInstructionConfigs(?array $instructionConfigs): void
    {
        foreach ($instructionConfigs ?? [] as $instructionConfig) {
            if (isset($instructionConfig['items']) && is_array($instructionConfig['items'])) {
                foreach ($instructionConfig['items'] as $item) {
                    $this->instructionConfigs[] = new InstructionConfig($item);
                }
                continue;
            }
            if (is_array($instructionConfig)) {
                $this->instructionConfigs[] = new InstructionConfig($instructionConfig);
            }
        }
    }

    public function rewind(): void
    {
        $this->executeNum = [];
    }

    public function getStreamStatus(): FlowStreamStatus
    {
        return $this->flowStreamStatus;
    }

    public function setStreamStatus(FlowStreamStatus $flowStreamStatus): void
    {
        $this->flowStreamStatus = $flowStreamStatus;
    }

    public function getUniqueId(): string
    {
        return $this->uniqueId;
    }

    public function getUniqueParentId(): string
    {
        return $this->uniqueParentId;
    }

    public function getMagicFlowEntity(): ?MagicFlowEntity
    {
        return $this->magicFlowEntity;
    }

    public function setMagicFlowEntity(?MagicFlowEntity $magicFlowEntity): void
    {
        $this->magicFlowEntity = $magicFlowEntity;
    }

    public function isThirdPlatformChat(): bool
    {
        return (bool) ThirdPlatformChatType::tryFrom($this->operator->getSourceId());
    }

    private function initGlobalVariable(): void
    {
        $variable = $this->triggerData->getGlobalVariable();
        if (! $variable?->isForm()) {
            return;
        }
        $variableData = $variable->getForm()->getKeyValue();
        if (! is_array($variableData)) {
            return;
        }
        foreach ($variableData as $key => $data) {
            $this->variableSave((string) $key, $data);
        }
    }
}
