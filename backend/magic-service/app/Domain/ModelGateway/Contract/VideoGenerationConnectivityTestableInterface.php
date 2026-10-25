<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Contract;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;

/**
 * 视频 provider adapter 可选的连通性测试能力。
 *
 * 实现方不需要发起真实生成任务，只需验证 base_url 与鉴权链路可用。
 */
interface VideoGenerationConnectivityTestableInterface extends VideoGenerationProviderAdapterInterface
{
    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool;
}
