<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Event;

/**
 * 录音总结触发事件（用于异步处理：下载/合并/上传/清理/发消息）。
 */
readonly class AsrSummaryRequestedEvent
{
    public function __construct(
        public string $taskKey,
        public string $projectId,
        public string $topicId,
        public string $modelId,
        public string $userId,
        public string $organizationCode,
        public ?string $workspaceFilePath = null,
        /** @var null|array<string,string> $note */
        public ?array $note = null,
        public ?string $asrStreamContent = null,
        public ?string $generatedTitle = null,
    ) {
    }
}
