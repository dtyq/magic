<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;

/**
 * Keling 模型能力提供器。
 *
 * 负责声明模型匹配规则和生成能力配置，
 * 让 adapter 只保留 payload 构造与 provider 交互逻辑。
 */
interface KelingGenerationCapabilityProviderInterface
{
    public function supportsModel(string $modelVersion, string $modelId): bool;

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig;

    /**
     * @param array<string, mixed> $generation
     */
    public function resolveGenerationMode(array $generation): string;

    /**
     * @param array<string, mixed> $generation
     */
    public function resolveDuration(array $generation): string;
}
