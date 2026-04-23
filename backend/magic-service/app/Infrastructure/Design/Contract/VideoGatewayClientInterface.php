<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Design\Contract;

interface VideoGatewayClientInterface
{
    /**
     * @param array<string, mixed> $payload
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    public function submitVideo(array $payload, array $businessParams): array;

    /**
     * 预估视频生成积分，只返回费用结果，不创建 provider 任务。
     *
     * @param array<string, mixed> $payload
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    public function estimateVideo(array $payload, array $businessParams): array;

    /**
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    public function queryVideo(string $operationId, array $businessParams): array;
}
