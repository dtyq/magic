<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\ValueObject;

use App\Infrastructure\Util\Aes\AesUtil;
use DateTime;

use function Hyperf\Config\config;

// 隐式水印
class ImplicitWatermark
{
    protected string $userId;

    protected string $organizationCode;

    protected DateTime $createdAt;

    protected string $topicId = '';

    protected string $sign = '';

    protected string $agentId = '';

    public function __construct()
    {
        $this->createdAt = new DateTime();
        // 设置默认签名，在设置用户信息后会自动加密
        $this->sign = 'super_magic';
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $currentSign = $this->getSign(); // 先解密获取原始签名
        $this->userId = $userId;
        if (! empty($currentSign)) {
            $this->setSign($currentSign); // 重新加密签名
        }
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $currentSign = $this->getSign(); // 先解密获取原始签名
        $this->organizationCode = $organizationCode;
        if (! empty($currentSign)) {
            $this->setSign($currentSign); // 重新加密签名
        }
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
        $decrypted = AesUtil::decode($this->_getAesKey(), $this->sign);
        return $decrypted !== false ? $decrypted : $this->sign;
    }

    public function setSign(string $sign): self
    {
        $encrypted = AesUtil::encode($this->_getAesKey(), $sign);
        $this->sign = $encrypted !== false ? $encrypted : $sign;
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
            'sign' => $this->sign, // 使用解密后的签名
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
     * Get AES key with salt (userId + organizationCode).
     */
    private function _getAesKey(): string
    {
        $baseKey = config('image_generate.watermark_aes_key', '');
        $salt = ($this->userId ?? '') . ($this->organizationCode ?? '');
        return $baseKey . $salt;
    }
}
