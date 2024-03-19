<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class TotalMetricsDTO extends AbstractDTO
{
    /**
     * @var int 用户总数
     */
    protected int $userCount = 0;

    /**
     * @var int 话题总数
     */
    protected int $topicCount = 0;

    /**
     * 获取用户总数.
     */
    public function getUserCount(): int
    {
        return $this->userCount;
    }

    /**
     * 设置用户总数.
     */
    public function setUserCount(int $userCount): self
    {
        $this->userCount = $userCount;
        return $this;
    }

    /**
     * 获取话题总数.
     */
    public function getTopicCount(): int
    {
        return $this->topicCount;
    }

    /**
     * 设置话题总数.
     */
    public function setTopicCount(int $topicCount): self
    {
        $this->topicCount = $topicCount;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'user_count' => $this->userCount,
            'topic_count' => $this->topicCount,
        ];
    }
}
