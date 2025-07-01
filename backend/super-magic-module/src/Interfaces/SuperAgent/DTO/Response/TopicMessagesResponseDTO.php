<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use JsonSerializable;

class TopicMessagesResponseDTO implements JsonSerializable
{
    /**
     * @var array 消息列表
     */
    protected array $list = [];

    /**
     * @var int 总记录数
     */
    protected int $total = 0;

    /**
     * @var int 当前页码
     */
    protected int $page = 1;

    /**
     * 构造函数.
     *
     * @param array $list 消息列表
     * @param int $total 总记录数
     * @param int $page 当前页码
     */
    public function __construct(array $list = [], int $total = 0, int $page = 1)
    {
        $this->list = $list;
        $this->total = $total;
        $this->page = $page;
    }

    /**
     * 获取消息列表.
     */
    public function getList(): array
    {
        return $this->list;
    }

    /**
     * 获取总记录数.
     */
    public function getTotal(): int
    {
        return $this->total;
    }

    /**
     * 获取当前页码.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
            'page' => $this->page,
        ];
    }

    /**
     * 序列化为JSON.
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
