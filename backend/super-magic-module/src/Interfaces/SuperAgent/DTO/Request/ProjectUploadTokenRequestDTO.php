<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use JsonSerializable;

/**
 * 项目文件上传 STS Token 请求 DTO.
 */
class ProjectUploadTokenRequestDTO implements JsonSerializable
{
    /**
     * 项目ID.
     */
    private string $projectId = '';

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

        $instance->projectId = $data['project_id'] ?? '';
        $instance->expires = (int) ($data['expires'] ?? 3600);

        return $instance;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
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
            'project_id' => $this->projectId,
            'expires' => $this->expires,
        ];
    }
}
