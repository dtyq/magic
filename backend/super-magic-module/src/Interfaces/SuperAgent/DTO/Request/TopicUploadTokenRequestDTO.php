<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use JsonSerializable;

/**
 * 话题文件上传 STS Token 请求 DTO.
 */
class TopicUploadTokenRequestDTO implements JsonSerializable
{
    /**
     * 话题ID.
     */
    private string $topicId = '';

    /**
     * 凭证有效期（秒）.
     */
    private int $expires = 3600;

    /**
     * 从请求数据创建DTO.
     */
    public static function fromRequest(array $data): self
    {
        $instance = new self();

        $instance->topicId = $data['topic_id'] ?? '';
        $instance->expires = (int) ($data['expires'] ?? 3600);

        return $instance;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getExpires(): int
    {
        return $this->expires;
    }

    public function setExpires(int $expires): self
    {
        $this->expires = $expires;
        return $this;
    }

    /**
     * 实现JsonSerializable接口.
     */
    public function jsonSerialize(): array
    {
        return [
            'topic_id' => $this->topicId,
            'expires' => $this->expires,
        ];
    }
}
