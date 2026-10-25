<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Message;

/**
 * Design 视频异步提交消息。
 */
final readonly class DesignVideoSubmitMessage
{
    public function __construct(
        public string $organizationCode,
        public int $projectId,
        public string $generationId,
    ) {
    }

    /**
     * 转换为消息队列载荷。
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'organization_code' => $this->organizationCode,
            'project_id' => $this->projectId,
            'generation_id' => $this->generationId,
        ];
    }

    /**
     * 从消息队列载荷恢复消息对象。
     *
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            (string) ($data['organization_code'] ?? ''),
            (int) ($data['project_id'] ?? 0),
            (string) ($data['generation_id'] ?? ''),
        );
    }
}
