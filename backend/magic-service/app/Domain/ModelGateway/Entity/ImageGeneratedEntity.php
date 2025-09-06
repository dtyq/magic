<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use DateTime;

class ImageGeneratedEntity
{
    protected string $organizationCode;

    protected string $userId;

    protected string $model;

    protected int $imageCount;

    protected ?string $topicId = null;

    protected ?string $taskId = null;

    protected DateTime $createdAt;

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    public function getImageCount(): int
    {
        return $this->imageCount;
    }

    public function setImageCount(int $imageCount): void
    {
        $this->imageCount = $imageCount;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getTaskId(): ?string
    {
        return $this->taskId;
    }

    public function setTaskId(?string $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }
}
