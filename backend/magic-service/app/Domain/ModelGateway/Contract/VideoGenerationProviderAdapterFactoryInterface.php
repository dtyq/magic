<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Contract;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;

/**
 * 视频生成 adapter 工厂抽象。
 *
 * 由 domain 定义接口，由 infrastructure 实现。
 * 这样 domain service 可以通过 providerCode 拿到 adapter，
 * 同时不需要直接依赖 ExternalAPI 下的具体实现类。
 */
interface VideoGenerationProviderAdapterFactoryInterface
{
    /**
     * 按 providerCode 返回对应 adapter。
     *
     * modelVersion 仅用于辅助定位和报错，不作为唯一查找键。
     */
    public function createByProviderCode(ProviderCode $providerCode, ?string $modelVersion = null): VideoGenerationProviderAdapterInterface;
}
