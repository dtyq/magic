<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Event;

class AsrSummaryMessage
{
    public function __construct(
        public string $taskKey,
        public string $projectId,
        public string $topicId,
        public string $modelId,
        public ?string $fileId,
        public ?string $generatedTitle,
        public string $userId,
        public string $organizationCode,
        public string $language,
        public string $requestId,
        public int $retryCount = 0
    ) {
    }

    public function toArray(): array
    {
        return [
            'task_key' => $this->taskKey,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'model_id' => $this->modelId,
            'file_id' => $this->fileId,
            'generated_title' => $this->generatedTitle,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'language' => $this->language,
            'request_id' => $this->requestId,
            'retry_count' => $this->retryCount,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            (string) ($data['task_key'] ?? ''),
            (string) ($data['project_id'] ?? ''),
            (string) ($data['topic_id'] ?? ''),
            (string) ($data['model_id'] ?? ''),
            $data['file_id'] ?? null,
            $data['generated_title'] ?? null,
            (string) ($data['user_id'] ?? ''),
            (string) ($data['organization_code'] ?? ''),
            (string) ($data['language'] ?? 'zh_CN'),
            (string) ($data['request_id'] ?? ''),
            (int) ($data['retry_count'] ?? 0)
        );
    }
}
