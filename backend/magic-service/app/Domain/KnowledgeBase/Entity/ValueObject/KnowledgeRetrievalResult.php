<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

/**
 * 知识库检索结果值对象.
 *
 * 统一表示从不同检索方法（语义检索、全文检索、图检索等）返回的知识片段
 */
class KnowledgeRetrievalResult extends AbstractValueObject
{
    /**
     * 语义检索类型.
     */
    public const string TYPE_SEMANTIC = 'semantic';

    /**
     * 全文检索类型.
     */
    public const string TYPE_FULLTEXT = 'fulltext';

    /**
     * 图检索类型.
     */
    public const string TYPE_GRAPH = 'graph';

    /**
     * 混合检索类型.
     */
    public const string TYPE_HYBRID = 'hybrid';

    /**
     * 唯一标识符.
     */
    private string $id = '';

    /**
     * 内容.
     */
    private string $content = '';

    /**
     * 业务ID.
     */
    private string $businessId = '';

    /**
     * 元数据.
     */
    private array $metadata = [];

    /**
     * 类型（semantic, fulltext, graph, hybrid等）.
     */
    private string $type = self::TYPE_SEMANTIC;

    private float $score = 0;

    /**
     * 从知识库片段实体创建检索结果.
     *
     * @param string $id 唯一标识符
     * @param string $content 内容
     * @param string $businessId 业务ID
     * @param array $metadata 元数据
     */
    public static function fromFragment(
        string $id = '',
        string $content = '',
        string $businessId = '',
        array $metadata = [],
        float $score = 0,
    ): self {
        $instance = new self();
        $instance->setId($id);
        $instance->setContent($content);
        $instance->setBusinessId($businessId);
        $instance->setMetadata($metadata);
        $instance->setType(self::TYPE_SEMANTIC);
        $instance->setScore($score);

        return $instance;
    }

    /**
     * 从图数据创建检索结果.
     *
     * @param string $id 唯一标识符
     * @param string $content 内容
     * @param string $businessId 业务ID
     * @param array $metadata 元数据
     */
    public static function fromGraphData(
        string $id = '',
        string $content = '',
        string $businessId = '',
        array $metadata = []
    ): self {
        $instance = new self();
        $instance->setId($id);
        $instance->setContent($content);
        $instance->setBusinessId($businessId);
        $instance->setMetadata($metadata);
        $instance->setType(self::TYPE_GRAPH);

        return $instance;
    }

    /**
     * 创建空的检索结果.
     */
    public static function empty(): self
    {
        return new self();
    }

    /**
     * 获取唯一标识符.
     */
    public function getId(): string
    {
        return $this->id;
    }

    /**
     * 设置唯一标识符.
     *
     * @param string $id 唯一标识符
     */
    public function setId(string $id): self
    {
        $this->id = $id;
        return $this;
    }

    /**
     * 获取内容.
     */
    public function getContent(): string
    {
        return $this->content;
    }

    /**
     * 设置内容.
     *
     * @param string $content 内容
     */
    public function setContent(string $content): self
    {
        $this->content = $content;
        return $this;
    }

    /**
     * 获取业务ID.
     */
    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    /**
     * 设置业务ID.
     *
     * @param string $businessId 业务ID
     */
    public function setBusinessId(string $businessId): self
    {
        $this->businessId = $businessId;
        return $this;
    }

    /**
     * 获取元数据.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * 设置元数据.
     *
     * @param array $metadata 元数据
     */
    public function setMetadata(array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    /**
     * 获取类型.
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * 设置类型.
     *
     * @param string $type 类型
     */
    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }

    /**
     * 检查是否为语义检索类型.
     */
    public function isSemantic(): bool
    {
        return $this->type === self::TYPE_SEMANTIC;
    }

    /**
     * 检查是否为全文检索类型.
     */
    public function isFulltext(): bool
    {
        return $this->type === self::TYPE_FULLTEXT;
    }

    /**
     * 检查是否为图检索类型.
     */
    public function isGraph(): bool
    {
        return $this->type === self::TYPE_GRAPH;
    }

    /**
     * 检查是否为混合检索类型.
     */
    public function isHybrid(): bool
    {
        return $this->type === self::TYPE_HYBRID;
    }

    public function getScore(): float
    {
        return $this->score;
    }

    public function setScore(float $score): static
    {
        $this->score = $score;
        return $this;
    }
}
