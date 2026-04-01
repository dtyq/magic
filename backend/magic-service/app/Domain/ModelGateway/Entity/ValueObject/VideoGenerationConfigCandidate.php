<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;

/**
 * featured 视频能力聚合时使用的候选项。
 *
 * 这个值对象只保存做能力求交集所需的最小信息：
 * - 逻辑模型 ID
 * - provider 侧模型版本
 * - providerCode
 *
 * app 层负责整理候选项，domain service 负责解析配置和求交集。
 */
readonly class VideoGenerationConfigCandidate
{
    public function __construct(
        private string $modelId,
        private string $modelVersion,
        private ProviderCode $providerCode,
    ) {
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function getProviderCode(): ProviderCode
    {
        return $this->providerCode;
    }
}
