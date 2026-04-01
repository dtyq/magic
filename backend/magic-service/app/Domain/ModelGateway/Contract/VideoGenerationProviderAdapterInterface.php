<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Contract;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

/**
 * 视频生成 provider adapter 的统一抽象。
 *
 * 这层 contract 由 domain 定义，具体 provider 在 infrastructure 实现。
 * 当前这个接口同时覆盖两类能力：
 *
 * 1. 能力声明：
 *    返回当前系统“已经接入并真实支持”的统一视频参数配置。
 *    这里不描述 provider 官方理论上限。
 *
 * 2. 执行适配：
 *    把统一请求结构转换成各 provider 自己的 payload，并完成 submit/query。
 *
 * 这样 featured 与运行时校验可以共享同一套能力来源。
 */
interface VideoGenerationProviderAdapterInterface
{
    /**
     * 判断当前 adapter 是否支持该 provider 下的某个视频模型。
     *
     * 这里判断的是“系统当前是否已经接入并实现”，
     * 不是 provider 官方是否宣称支持。
     */
    public function supportsModel(string $modelVersion, string $modelId): bool;

    /**
     * 返回当前 provider + model 的统一视频参数配置。
     *
     * generation.sizes 需要返回“真实支持的具体宽高组合表”，
     * 不能只返回比例后让前端自行推导，也不能把 4k 能力自动补全到所有比例。
     *
     * 返回 null 表示当前代码里没有为这个模型声明实际能力。
     */
    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig;

    /**
     * 把统一请求结构映射成 provider 自己的 payload。
     *
     * 参数支持性不在这里判断，进入 adapter 前应当已经完成能力校验。
     */
    public function buildProviderPayload(VideoQueueOperationEntity $operation): array;

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string;

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array;
}
