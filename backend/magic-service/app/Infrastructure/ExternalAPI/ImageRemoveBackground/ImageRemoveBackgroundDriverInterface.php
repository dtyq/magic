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
    public function getProviderCode(): string;

    public function supportsDirectUrl(): bool;

    public function removeBackground(ImageRemoveBackgroundDriverRequest $request): ImageRemoveBackgroundResult;

    public function testConnection(ImageRemoveBackgroundDriverRequest $request): void;
}
