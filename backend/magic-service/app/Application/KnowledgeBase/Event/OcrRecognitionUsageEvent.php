<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event;

class OcrRecognitionUsageEvent
{
    public function __construct(
        public string $provider,
        public string $organizationCode,
        public string $userId,
        public int $pageCount,
        public string $fileType,
        public array $businessParams = [],
    ) {
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getPageCount(): int
    {
        return $this->pageCount;
    }

    public function getFileType(): string
    {
        return $this->fileType;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function getBusinessParam(string $key, mixed $default = null): mixed
    {
        return $this->businessParams[$key] ?? $default;
    }

    public function toArray(): array
    {
        return [
            'provider' => $this->provider,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'page_count' => $this->pageCount,
            'file_type' => $this->fileType,
            'business_params' => $this->businessParams,
        ];
    }
}
