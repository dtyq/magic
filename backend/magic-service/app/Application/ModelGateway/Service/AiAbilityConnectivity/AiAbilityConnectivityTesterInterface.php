<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;

interface AiAbilityConnectivityTesterInterface
{
    public function supports(AiAbilityCode $aiAbilityCode): bool;

    /**
     * @param array $aiAbilityConfig 完整能力配置
     * @param array $enabledProviderConfig 当前启用的 provider 配置
     * @return array{provider:string,message:string,duration_ms:int}
     */
    public function test(array $aiAbilityConfig, array $enabledProviderConfig): array;
}
