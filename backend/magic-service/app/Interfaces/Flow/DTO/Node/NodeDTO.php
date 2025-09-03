<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\Node;

use App\Interfaces\Flow\Assembler\Node\MagicFlowNodeAssembler;
use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class NodeDTO extends AbstractFlowDTO
{
    public string $nodeId = '';

    public bool $debug = false;

    public string $name = '';

    public string $description = '';

    public int $nodeType = 0;

    public string $nodeVersion = '';

    /**
     * 节点元数据，可用作给前端的定位，后端仅存储和展示，没有任何逻辑.
     */
    public array $meta = [];

    /**
     * 节点参数配置，目前依靠数组来数据传递.
     */
    public array $params = [];

    public array $nextNodes = [];

    public ?NodeInputDTO $input = null;

    public ?NodeOutputDTO $output = null;

    public ?NodeOutputDTO $systemOutput = null;

    /**
     * 获取节点ID.
     */
    public function getNodeId(): string
    {
        return $this->nodeId;
    }

    /**
     * 设置节点ID.
     */
    public function setNodeId(?string $nodeId): self
    {
        $this->nodeId = $nodeId ?? '';
        return $this;
    }

    /**
     * 获取是否为调试模式.
     */
    public function isDebug(): bool
    {
        return $this->debug;
    }

    public function getDebug(): bool
    {
        return $this->debug;
    }

    /**
     * 设置是否为调试模式.
     */
    public function setDebug(?bool $debug): self
    {
        $this->debug = $debug ?? false;
        return $this;
    }

    /**
     * 获取节点名称.
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * 设置节点名称.
     */
    public function setName(?string $name): self
    {
        $this->name = $name ?? '';
        return $this;
    }

    /**
     * 获取节点描述.
     */
    public function getDescription(): string
    {
        return $this->description;
    }

    /**
     * 设置节点描述.
     */
    public function setDescription(?string $description): self
    {
        $this->description = $description ?? '';
        return $this;
    }

    /**
     * 获取节点类型.
     */
    public function getNodeType(): int
    {
        return $this->nodeType;
    }

    /**
     * 设置节点类型.
     */
    public function setNodeType(null|int|string $nodeType): self
    {
        $this->nodeType = (int) ($nodeType ?? 0);
        return $this;
    }

    /**
     * 获取节点版本.
     */
    public function getNodeVersion(): string
    {
        return $this->nodeVersion;
    }

    /**
     * 设置节点版本.
     */
    public function setNodeVersion(?string $nodeVersion): self
    {
        $this->nodeVersion = $nodeVersion ?? '';
        return $this;
    }

    /**
     * 获取节点元数据.
     */
    public function getMeta(): array
    {
        return $this->meta;
    }

    /**
     * 设置节点元数据.
     */
    public function setMeta(?array $meta): self
    {
        $this->meta = $meta ?? [];
        return $this;
    }

    /**
     * 获取节点参数配置.
     */
    public function getParams(): array
    {
        return $this->params;
    }

    /**
     * 设置节点参数配置.
     */
    public function setParams(?array $params): self
    {
        $this->params = $params ?? [];
        return $this;
    }

    /**
     * 获取下一节点列表.
     */
    public function getNextNodes(): array
    {
        return $this->nextNodes;
    }

    /**
     * 设置下一节点列表.
     */
    public function setNextNodes(?array $nextNodes): self
    {
        $this->nextNodes = $nextNodes ?? [];
        return $this;
    }

    /**
     * 获取节点输入.
     */
    public function getInput(): ?NodeInputDTO
    {
        return $this->input;
    }

    /**
     * 设置节点输入.
     */
    public function setInput(mixed $input): void
    {
        $this->input = MagicFlowNodeAssembler::createNodeInputDTOByMixed($input);
    }

    /**
     * 获取节点输出.
     */
    public function getOutput(): ?NodeOutputDTO
    {
        return $this->output;
    }

    /**
     * 设置节点输出.
     */
    public function setOutput(mixed $output): void
    {
        $this->output = MagicFlowNodeAssembler::createNodeOutputDTOByMixed($output);
    }

    /**
     * 获取系统输出.
     */
    public function getSystemOutput(): ?NodeOutputDTO
    {
        return $this->systemOutput;
    }

    /**
     * 设置系统输出.
     */
    public function setSystemOutput(null|array|NodeOutputDTO $systemOutput): void
    {
        $this->systemOutput = MagicFlowNodeAssembler::createNodeOutputDTOByMixed($systemOutput);
    }
}
