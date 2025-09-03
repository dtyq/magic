<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\StartNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Closure;
use DateTime;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Throwable;

class MagicFlowEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    /**
     * 唯一编码，仅在创建时生成，用作给前端的id.
     */
    protected string $code;

    /**
     * 流程名称（助理名称）.
     */
    protected string $name;

    /**
     * 流程描述 （助理描述）.
     */
    protected string $description;

    /**
     * 流程图标（助理头像）.
     */
    protected string $icon = '';

    /**
     * 流程类型.
     */
    protected Type $type;

    protected string $toolSetId = '';

    /**
     * 仅前端需要，流程编排放到 node 节点配置的 next_nodes 中.
     */
    protected array $edges;

    /**
     * @var Node[]
     */
    protected array $nodes;

    protected ?Component $globalVariable = null;

    protected bool $enabled = false;

    protected string $versionCode = '';

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    private bool $isCollectingNodes = false;

    /**
     * 流程的入口.
     */
    private ?NodeInput $input = null;

    /**
     * 流程的出口.
     */
    private ?NodeOutput $output = null;

    private ?NodeInput $customSystemInput = null;

    private ?array $nodesById = null;

    private ?array $parentNodesById = null;

    private ?Node $startNode = null;

    private ?Node $endNode = null;

    private int $userOperation = 0;

    /**
     * 流程的回调函数，如果有该值，那么将直接执行该选择，而不是通过NodeRunner来执行.
     */
    private ?Closure $callback = null;

    private ?array $callbackResult = null;

    /**
     * agent id.
     */
    private string $agentId = '';

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareTestRun(): void
    {
        // 试运行是要按照开启时计算
        $this->enabled = true;

        // 流程试运行其实只需要 nodes
        if (empty($this->nodes)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.nodes']);
        }
        $this->collectNodes();
    }

    public function prepareForSaveNode(?MagicFlowEntity $magicFlowEntity): void
    {
        $this->nodeValidate();

        if ($magicFlowEntity) {
            $this->requiredValidate();

            $magicFlowEntity->setName($this->name);
            $magicFlowEntity->setDescription($this->description ?? '');
            $magicFlowEntity->setIcon($this->icon);
            $magicFlowEntity->setNodes($this->nodes);
            $magicFlowEntity->setEdges($this->edges);
            $magicFlowEntity->setModifier($this->creator);
            $magicFlowEntity->setUpdatedAt($this->createdAt);
        }
    }

    public function prepareForCreation(): void
    {
        $this->requiredValidate();

        $this->code = Code::MagicFlow->gen();
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->enabled = false;
        $this->nodes = [];
        $this->edges = [];
    }

    public function prepareForModification(MagicFlowEntity $magicFlow): void
    {
        $this->requiredValidate();

        $magicFlow->setName($this->name);
        $magicFlow->setDescription($this->description);
        $magicFlow->setIcon($this->icon);
        $magicFlow->setToolSetId($this->toolSetId);
        $magicFlow->setModifier($this->creator);
        $magicFlow->setUpdatedAt($this->createdAt);
    }

    public function prepareForChangeEnable(): void
    {
        $this->enabled = ! $this->enabled;
        if ($this->enabled) {
            // 如果是要开启，需要检测是否有 nodes 配置
            if (empty($this->nodes)) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.cannot_enable_empty_nodes');
            }
        }
    }

    public function prepareForPublish(MagicFlowVersionEntity $magicFlowVersionEntity, string $publisher): void
    {
        $this->versionCode = $magicFlowVersionEntity->getCode();

        $magicFlow = $magicFlowVersionEntity->getMagicFlow();

        $this->name = $magicFlow->getName();
        $this->description = $magicFlow->getDescription();
        $this->icon = $magicFlow->getIcon();
        $this->edges = $magicFlow->getEdges();
        $this->nodes = $magicFlow->getNodes();
        $this->globalVariable = $magicFlow->getGlobalVariable();

        foreach ($this->nodes as $node) {
            $node->getNodeParamsConfig()->setValidateScene('publish');
        }

        $this->modifier = $publisher;
        $this->updatedAt = new DateTime('now');

        // 发布时需要按照开启来处理
        $enable = $this->enabled;
        $this->enabled = true;
        $this->nodeValidate(true);
        // 复原
        $this->enabled = $enable;
    }

    public function collectNodes(bool $refresh = false): void
    {
        if ($refresh) {
            $this->isCollectingNodes = false;
        }
        if ($this->isCollectingNodes) {
            return;
        }
        $this->clearCollectNodes();

        $this->nodesById = [];
        $this->parentNodesById = [];
        foreach ($this->nodes as $node) {
            if (array_key_exists($node->getNodeId(), $this->nodesById)) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.duplication_node_id', ['node_id' => $node->getNodeId()]);
            }

            $this->nodesById[$node->getNodeId()] = $node;
            if ($node->getParentId()) {
                $this->parentNodesById[$node->getParentId()][] = $node;
            }

            if ($node->isStart() && ! $node->getParentId()) {
                // 如果已经有一个了，那么是错误的流程，出现了多个开始节点
                if ($this->startNode) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.start.only_one');
                }
                $this->startNode = $node;
            }
            if ($node->isEnd() && ! $node->getParentId()) {
                // 多个结束节点时，暂时取第一个，应该要做成只能有一个结束节点
                if (! $this->endNode) {
                    $this->endNode = $node;
                }
            }
        }

        // 已经是发布状态的才需要检测
        if ($this->enabled) {
            //            if (! $this->startNode) {
            //                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.start.must_exist');
            //            }
            //            if (! $this->endNode && $this->type->needEndNode()) {
            //                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.end.must_exist');
            //            }
        }

        if ($this->type->canShowParams()) {
            if ($this->startNode) {
                /** @var StartNodeParamsConfig $startNodeParamsConfig */
                $startNodeParamsConfig = $this->startNode->getNodeParamsConfig();
                foreach ($startNodeParamsConfig->getBranches() as $branch) {
                    if ($branch->getTriggerType() === TriggerType::ParamCall) {
                        $input = new NodeInput();
                        $input->setForm($branch->getOutput()?->getForm());
                        $this->input = $input;

                        $customSystemInput = new NodeInput();
                        $customSystemInput->setForm($branch->getCustomSystemOutput()?->getForm());
                        $this->customSystemInput = $customSystemInput;
                    }
                }
            }
            $this->output = $this->endNode?->getOutput();
        }

        $this->isCollectingNodes = true;
    }

    public function getResult(bool $throw = true): array
    {
        if ($this->getCallbackResult()) {
            return $this->getCallbackResult();
        }
        $result = [];
        foreach ($this->nodes as $node) {
            $nodeDebugResult = $node->getNodeDebugResult();
            if ($nodeDebugResult && ! $nodeDebugResult->isSuccess()) {
                if ($throw) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, $nodeDebugResult->getErrorMessage());
                }
                $result['error_information'] = $nodeDebugResult->getErrorMessage();
            }
            if ($node->isEnd() && $nodeDebugResult && $nodeDebugResult->hasExecute()) {
                // 结果优先，如果已经存在，则不需要了
                if (empty($result)) {
                    $result = $nodeDebugResult->getOutput() ?? [];
                }
            }
        }
        return $result;
    }

    public function getStartNode(): ?Node
    {
        if ($this->startNode) {
            return $this->startNode;
        }
        $this->collectNodes();
        return $this->startNode;
    }

    public function getEndNode(): ?Node
    {
        if ($this->endNode) {
            return $this->endNode;
        }
        $this->collectNodes();
        return $this->endNode;
    }

    public function prepareForDeletion()
    {
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (int) $id : null;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getType(): Type
    {
        return $this->type;
    }

    public function setType(Type $type): void
    {
        $this->type = $type;
    }

    public function getToolSetId(): string
    {
        return $this->toolSetId;
    }

    public function setToolSetId(string $toolSetId): void
    {
        $this->toolSetId = $toolSetId;
    }

    public function getEdges(): array
    {
        return $this->edges;
    }

    public function setEdges(array $edges): void
    {
        $this->edges = $edges;
    }

    public function getNodes(): array
    {
        return $this->nodes;
    }

    public function getNodeById(string $id): ?Node
    {
        $this->collectNodes();
        return $this->nodesById[$id] ?? null;
    }

    /**
     * @return Node[]
     */
    public function getNodesByParentId(string $parentId): array
    {
        $this->collectNodes();
        return $this->parentNodesById[$parentId] ?? [];
    }

    public function setNodes(array $nodes): void
    {
        $this->nodes = $nodes;
        $this->collectNodes(true);
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getVersionCode(): string
    {
        return $this->versionCode;
    }

    public function setVersionCode(string $versionCode): void
    {
        $this->versionCode = $versionCode;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getInput(): NodeInput
    {
        if ($this->input?->getFormComponent()) {
            return $this->input;
        }
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $this->input = $input;

        $this->collectNodes();
        return $this->input;
    }

    public function getOutput(): NodeOutput
    {
        if ($this->output?->getFormComponent()) {
            return $this->output;
        }
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $this->output = $output;

        $this->collectNodes();
        return $this->output;
    }

    public function getCustomSystemInput(): NodeInput
    {
        if ($this->customSystemInput?->getFormComponent()) {
            return $this->customSystemInput;
        }
        $customSystemInput = new NodeInput();
        $customSystemInput->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $this->customSystemInput = $customSystemInput;

        $this->collectNodes();
        return $this->customSystemInput;
    }

    public function getGlobalVariable(): ?Component
    {
        return $this->globalVariable;
    }

    public function setGlobalVariable(?Component $globalVariable): void
    {
        $this->globalVariable = $globalVariable;
    }

    public function setEndNode(?Node $endNode): void
    {
        $this->endNode = $endNode;
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(int $userOperation): void
    {
        $this->userOperation = $userOperation;
    }

    public function setInput(?NodeInput $input): void
    {
        $this->input = $input;
    }

    public function setOutput(?NodeOutput $output): void
    {
        $this->output = $output;
    }

    public function setCustomSystemInput(?NodeInput $customSystemInput): void
    {
        $this->customSystemInput = $customSystemInput;
    }

    public function hasCallback(): bool
    {
        return ! empty($this->callback);
    }

    public function getCallback(): ?Closure
    {
        return $this->callback;
    }

    public function setCallback(?Closure $callback): void
    {
        $this->callback = $callback;
    }

    public function getCallbackResult(): ?array
    {
        return $this->callbackResult;
    }

    public function setCallbackResult(?array $callbackResult): void
    {
        $this->callbackResult = $callbackResult;
    }

    public function getAgentId(): string
    {
        return $this->agentId;
    }

    public function setAgentId(string $agentId): void
    {
        $this->agentId = $agentId;
    }

    private function clearCollectNodes(): void
    {
        $this->nodesById = null;
        $this->parentNodesById = null;
        $this->startNode = null;
        $this->endNode = null;
        $this->input = null;
        $this->output = null;
    }

    private function requiredValidate(): void
    {
        $this->checkType();
        $this->checkOrganizationCode();
        $this->checkCreator();
        $this->checkName();
        $this->checkDescription();

        if (empty($this->toolSetId)) {
            $this->toolSetId = ConstValue::TOOL_SET_DEFAULT_CODE;
        }
    }

    private function checkType(): void
    {
        if (! isset($this->type)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.flow_type']);
        }
    }

    private function checkOrganizationCode(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.organization_code']);
        }
    }

    private function checkCreator(): void
    {
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
    }

    private function checkName(): void
    {
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.flow_name']);
        }

        if ($this->type === Type::Tools) {
            // 名称只能包含 字母、数字、下划线
            if (! preg_match('/^[a-zA-Z0-9_]+$/', $this->name)) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.tool.name.invalid_format');
            }
            // todo 要唯一
            // todo 内置工具名允许被使用
        }
    }

    private function checkDescription(): void
    {
        if ($this->type === Type::Tools) {
            if (empty($this->description)) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.tool_description']);
            }
        }
    }

    private function nodeValidate(bool $strict = false): void
    {
        $this->collectNodes();

        foreach ($this->nodes as $node) {
            try {
                $node->validate($strict);
            } catch (Throwable $throwable) {
                ExceptionBuilder::throw(
                    FlowErrorCode::ValidateFailed,
                    'flow.node.validation_failed',
                    [
                        'node_id' => $node->getNodeId(),
                        'node_type' => $node->getNodeTypeName(),
                        'error' => $throwable->getMessage(),
                    ]
                );
            }
        }
    }
}
