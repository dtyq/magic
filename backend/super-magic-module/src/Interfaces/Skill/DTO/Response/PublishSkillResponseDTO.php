<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * 发布技能到商店响应 DTO.
 */
class PublishSkillResponseDTO implements JsonSerializable
{
    /**
     * Skill 版本 ID.
     */
    private int $skillVersionId;

    /**
     * Skill 唯一标识码.
     */
    private string $skillCode;

    /**
     * 版本号.
     */
    private string $version;

    /**
     * 发布状态.
     */
    private string $publishStatus;

    /**
     * 审核状态.
     */
    private string $reviewStatus;

    /**
     * 创建时间（ISO 8601）.
     */
    private string $createdAt;

    public function __construct(
        int $skillVersionId,
        string $skillCode,
        string $version,
        string $publishStatus,
        string $reviewStatus,
        string $createdAt
    ) {
        $this->skillVersionId = $skillVersionId;
        $this->skillCode = $skillCode;
        $this->version = $version;
        $this->publishStatus = $publishStatus;
        $this->reviewStatus = $reviewStatus;
        $this->createdAt = $createdAt;
    }

    public function jsonSerialize(): array
    {
        return [
            'skill_version_id' => $this->skillVersionId,
            'skill_code' => $this->skillCode,
            'version' => $this->version,
            'publish_status' => $this->publishStatus,
            'review_status' => $this->reviewStatus,
            'created_at' => $this->createdAt,
        ];
    }
}
