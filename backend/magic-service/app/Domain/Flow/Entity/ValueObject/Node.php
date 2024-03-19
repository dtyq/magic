<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfigFactory;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Collector\ExecuteManager\FlowNodeCollector;
use App\Infrastructure\Core\Contract\Flow\NodeParamsConfigInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Closure;

class Node extends AbstractValueObject
{
    protected string $nodeId;

    protected bool $debug = false;

    protected string $name;

    protected string $description = '';

    protected int $nodeType;

    protected string $nodeVersion = '';

    /**
     * 节点元数据，可用作给前端的定位，后端仅存储和展示，没有任何逻辑.
     */
    protected array $meta = [];

    /**
     * 节点参数配置，目前依靠数组来数据传递.
     */
    protected array $params = [];

    /**
     * 下一个节点 id 列表.
     */
    protected array $nextNodes = [];

    protected ?NodeInput $input = null;

    protected ?NodeOutput $output = null;

    protected ?NodeOutput $systemOutput = null;

    /**
     * 节点调试结果.
     */
    protected ?NodeDebugResult $nodeDebugResult = null;

    /**
     * 节点执行的回调函数，如果有该值，那么将直接执行该选择，而不是通过NodeRunner来执行.
     * 这里暂时想到的是为了单测方便.
     */
    private ?Closure $callback = null;

    private bool $isValidate = false;

    private NodeParamsConfigInterface $nodeParamsConfig;

    private FlowNodeDefine $nodeDefine;

    public function __construct(int|NodeType $nodeType, string $version = '')
    {
        if ($nodeType instanceof NodeType) {
            $nodeType = $nodeType->value;
        }
        $this->nodeDefine = FlowNodeCollector::get($nodeType, $version);
        $this->nodeType = $nodeType;
        $this->nodeVersion = $this->nodeDefine->getVersion();
        // 初始化配置
        $this->nodeParamsConfig = NodeParamsConfigFactory::make($this);
        parent::__construct();
    }

    public function getNodeDefine(): FlowNodeDefine
    {
        return $this->nodeDefine;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getNodeId(): string
    {
        return $this->nodeId;
    }

    public function setNodeId(string $nodeId): void
    {
        $this->nodeId = $nodeId;
    }

    public function isDebug(): bool
    {
        return $this->debug;
    }

    public function getDebug(): bool
    {
        return $this->debug;
    }

    public function setDebug(bool $debug): void
    {
        $this->debug = $debug;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function isStart(): bool
    {
        return $this->nodeType === NodeType::Start->value;
    }

    public function isEnd(): bool
    {
        return $this->nodeType === NodeType::End->value;
    }

    public function getNodeType(): int
    {
        return $this->nodeType;
    }

    public function getNodeTypeName(): string
    {
        return $this->nodeDefine->getName();
    }

    public function setNodeType(int|NodeType $nodeType): void
    {
        if ($nodeType instanceof NodeType) {
            $nodeType = $nodeType->value;
        }
        $this->nodeType = $nodeType;
    }

    public function getNodeVersion(): string
    {
        return $this->nodeVersion;
    }

    public function setNodeVersion(string $nodeVersion): void
    {
        $this->nodeVersion = $nodeVersion;
    }

    public function getMeta(): array
    {
        return $this->meta;
    }

    public function setMeta(array $meta): void
    {
        $this->meta = $meta;
    }

    public function getParams(): array
    {
        return $this->params;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }

    public function getNextNodes(): array
    {
        $this->nextNodes = array_filter($this->nextNodes, fn ($nodeId) => $nodeId !== $this->nodeId);
        return $this->nextNodes;
    }

    public function setNextNodes(array $nextNodes): void
    {
        $this->nextNodes = $nextNodes;
    }

    public function getInput(): ?NodeInput
    {
        return $this->input;
    }

    public function setInput(?NodeInput $input): void
    {
        $this->input = $input;
    }

    public function getOutput(): ?NodeOutput
    {
        return $this->output;
    }

    public function setOutput(?NodeOutput $output): void
    {
        $this->output = $output;
    }

    public function getSystemOutput(): ?NodeOutput
    {
        return $this->systemOutput;
    }

    public function setSystemOutput(?NodeOutput $systemOutput): void
    {
        $this->systemOutput = $systemOutput;
    }

    public function getNodeDebugResult(): ?NodeDebugResult
    {
        return $this->nodeDebugResult;
    }

    public function setNodeDebugResult(?NodeDebugResult $nodeDebugResult): void
    {
        $this->nodeDebugResult = $nodeDebugResult;
    }

    public function getCallback(): ?Closure
    {
        return $this->callback;
    }

    public function setCallback(?Closure $callback): void
    {
        $this->callback = $callback;
    }

    public function isValidate(): bool
    {
        return $this->isValidate;
    }

    public function setIsValidate(bool $isValidate): void
    {
        $this->isValidate = $isValidate;
    }

    public function getNodeParamsConfig(): NodeParamsConfigInterface
    {
        return $this->nodeParamsConfig;
    }

    public function setNodeParamsConfig(NodeParamsConfigInterface $nodeParamsConfig): void
    {
        $this->nodeParamsConfig = $nodeParamsConfig;
    }

    public function getName(): string
    {
        return $this->name ?? $this->getNodeTypeName();
    }

    public function getSystemNodeId(): string
    {
        return $this->nodeId . '_system';
    }

    public function getCustomSystemNodeId(): string
    {
        return $this->nodeId . '_custom_system';
    }

    public static function generateTemplate(int|NodeType $nodeType, array $params = [], string $nodeVersion = ''): Node
    {
        if ($nodeType instanceof NodeType) {
            $nodeType = $nodeType->value;
        }
        $nodeId = Code::MagicFlowNode->gen();
        $nodeDefine = FlowNodeCollector::get($nodeType, $nodeVersion);

        $node = new self($nodeType, $nodeVersion);
        $node->setNodeId($nodeId);
        $node->setName($nodeDefine->getName());
        $node->setDescription($nodeDefine->getDescription());
        $node->setMeta([]);
        $node->setNextNodes([]);
        $node->getNodeParamsConfig()->generateTemplate();
        if (! empty($params)) {
            $node->setParams($params);
        }
        return $node;
    }

    public function validate(bool $strict = false): void
    {
        if ($this->isValidate) {
            return;
        }
        if (empty($this->nodeId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node_id.empty');
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.name.empty');
        }
        if (empty($this->nodeType)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node_type.empty');
        }
        $this->validateInput($strict);
        $this->validateOutput($strict);
        $this->validateParams();
        $this->isValidate = true;
    }

    public function getParentId(): string
    {
        return $this->meta['parent_id'] ?? '';
    }

    public function hasCallback(): bool
    {
        return ! empty($this->callback);
    }

    private function validateInput(bool $strict = false): void
    {
        if (! $this->nodeDefine->isNeedInput()) {
            $this->input = null;
            return;
        }

        if (empty($this->input) || empty($this->input->getForm())) {
        }
        if ($strict) {
            $this->input?->getFormComponent()?->getForm();
        }
    }

    private function validateOutput(bool $strict = false): void
    {
        if (! $this->nodeDefine->isNeedOutput()) {
            $this->output = null;
            return;
        }
        if (empty($this->output) || empty($this->output->getForm())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node_output.empty', ['label' => $this->name]);
        }
        if ($strict) {
            $this->output?->getFormComponent()?->getForm();
        }
    }

    private function validateParams(): void
    {
        $this->params = $this->nodeParamsConfig->validate();
    }
}
