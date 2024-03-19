<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\ValueObject;

use DateTime;

use function Hyperf\Config\config;

// 隐式水印
class ImplicitWatermark
{
    protected string $userId;

    protected string $organizationCode;

    protected DateTime $createdAt;

    protected string $topicId = '';

    protected string $agentId = '';

    protected string $accessTokenId = '';

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

    public function getAccessTokenId(): string
    {
        return $this->accessTokenId;
    }

    public function setAccessTokenId(string $accessTokenId): self
    {
        $this->accessTokenId = $accessTokenId;
        return $this;
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
            'sign' => $this->getEncryptedSign(), // 使用原始签名
        ];

        if ($this->topicId !== '') {
            $data['topicId'] = $this->topicId;
        }

        if ($this->agentId !== '') {
            $data['agentId'] = $this->agentId;
        }

        return $data;
    }

    /**
     * 生成超级麦吉AIGC隐式标识格式的元数据.
     */
    public function toAIGCMetadata(): array
    {
        return [
            'AIGC' => [
                'Label' => config('image_generate.aigc_metadata.label', '2'),
                'ContentProducter' => config('image_generate.aigc_metadata.content_producer', '001191440300MA5HTEC8X100000'),
                'ProduceID' => $this->getProduceId(),
                'ReservedCode1' => $this->getEncryptedSign(),
            ],
        ];
    }

    public function getProduceId(): string
    {
        // 按优先级选择会话标识: tid > aid > kid
        $sessionIdentifier = $this->getSessionIdentifier();

        return sprintf(
            '%s+%s+%s+%s',
            $this->userId,
            $this->organizationCode,
            $sessionIdentifier,
            $this->createdAt->format('YmdHis') // 格式化为时间戳格式 YYYYMMDDHHmmss
        );
    }

    /**
     * 按优先级获取会话标识符
     * 优先级: topicId > agentId > accessTokenId.
     */
    private function getSessionIdentifier(): string
    {
        if ($this->topicId !== '') {
            return 'tid:' . $this->topicId;
        }

        if ($this->agentId !== '') {
            return 'aid:' . $this->agentId;
        }

        if ($this->accessTokenId !== '') {
            return 'kid:' . $this->accessTokenId;
        }

        return ''; // 都没有时返回空
    }

    /**
     * 获取哈希后的签名（使用 SHA-256 哈希 + Salt）.
     */
    private function getEncryptedSign(): string
    {
        $productId = $this->getProduceId();
        $key = $this->getWatermarkAesKey();
        $salt = $this->getWatermarkSignSalt();
        $data = $salt . $productId;
        return hash_hmac('sha256', $data, $key);
    }

    private function getWatermarkAesKey()
    {
        return config('image_generate.watermark_aes_key', '');
    }

    private function getWatermarkSignSalt(): string
    {
        return config('image_generate.watermark_sign_salt', '');
    }
}
