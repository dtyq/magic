<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\ValueObject;

use DateTime;

// 隐式水印
class ImplicitWatermark
{
    protected string $userId;

    protected string $organizationCode;

    protected DateTime $createdAt;

    protected string $topicId = '';

    protected string $sign = 'super_magic';

    protected string $agentId = '';

    public function __construct()
    {
        $this->createdAt = new DateTime();
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
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

    public function getSign(): string
    {
        return $this->sign;
    }

    public function getAgentId(): string
    {
        return $this->agentId;
    }

    public function setAgentId(string $agentId): self
    {
        $this->agentId = $agentId;
        return $this;
    }

    public function toArray(): array
    {
        $data = [
            'userId' => $this->userId,
            'organizationCode' => $this->organizationCode,
            'createdAt' => $this->createdAt->format('Y-m-d H:i:s'),
            'sign' => $this->sign,
        ];

        if ($this->topicId !== '') {
            $data['topicId'] = $this->topicId;
        }

        if ($this->agentId !== '') {
            $data['agentId'] = $this->agentId;
        }

        return $data;
    }
}
