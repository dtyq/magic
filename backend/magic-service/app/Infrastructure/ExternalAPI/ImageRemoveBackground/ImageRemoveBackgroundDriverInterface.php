<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageRemoveBackground;

use App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO\ImageRemoveBackgroundDriverRequest;

/**
 * 统一定义去背景第三方驱动能力边界，屏蔽各服务商的协议差异。
 */
interface ImageRemoveBackgroundDriverInterface
{
    /**
     * 返回当前 driver 对应的 provider 标识，便于日志和响应透传。
     */
    public function getProviderCode(): string;

    /**
     * 标识当前 driver 是否可以直接消费公开 URL。
     */
    public function supportsDirectUrl(): bool;

    /**
     * 执行去背景并返回该能力专属结果对象。
     * application 层会再把这个结果转换成通用图片资产进入后处理管线。
     */
    public function removeBackground(ImageRemoveBackgroundDriverRequest $request): ImageRemoveBackgroundResult;

    /**
     * 仅用于能力配置页的连通性校验，不要求走完整个平台后处理链。
     */
    public function testConnection(ImageRemoveBackgroundDriverRequest $request): void;
}
