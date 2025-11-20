<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 初始化元数据 DTO.
 * 用于封装初始化 Agent 时的元数据配置，方便后续扩展.
 */
class InitializationMetadataDTO
{
    /**
     * 构造函数.
     *
     * @param bool $skipInitMessages 是否跳过初始化消息，用于 ASR 场景
     */
    public function __construct(
        private bool $skipInitMessages = false
    ) {
    }

    /**
     * 创建默认实例.
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * 获取是否跳过初始化消息.
     *
     * @return bool 是否跳过初始化消息
     */
    public function getSkipInitMessages(): bool
    {
        return $this->skipInitMessages;
    }

    /**
     * 设置是否跳过初始化消息.
     *
     * @param bool $skipInitMessages 是否跳过初始化消息
     * @return self 新的实例
     */
    public function withSkipInitMessages(bool $skipInitMessages): self
    {
        $clone = clone $this;
        $clone->skipInitMessages = $skipInitMessages;
        return $clone;
    }
}
