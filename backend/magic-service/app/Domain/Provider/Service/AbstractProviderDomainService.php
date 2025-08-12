<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;

abstract class AbstractProviderDomainService
{
    /**
     * 处理脱敏后的配置数据
     * 如果数据是脱敏格式（前3位+星号+后3位），则使用原始值；否则使用新值
     *
     * @param ProviderConfigItem $newConfig 新的配置数据（可能包含脱敏信息）
     * @param ProviderConfigItem $oldConfig 旧的配置数据（包含原始值）
     * @return ProviderConfigItem 处理后的配置数据
     */
    protected function processDesensitizedConfig(
        ProviderConfigItem $newConfig,
        ProviderConfigItem $oldConfig
    ): ProviderConfigItem {
        // 检查ak是否为脱敏后的格式
        $ak = $newConfig->getAk();
        if (! empty($ak) && preg_match('/^.{3}\*+.{3}$/', $ak)) {
            $newConfig->setAk($oldConfig->getAk());
        }

        // 检查sk是否为脱敏后的格式
        $sk = $newConfig->getSk();
        if (! empty($sk) && preg_match('/^.{3}\*+.{3}$/', $sk)) {
            $newConfig->setSk($oldConfig->getSk());
        }

        // 检查apiKey是否为脱敏后的格式
        $apiKey = $newConfig->getApiKey();
        if (! empty($apiKey) && preg_match('/^.{3}\*+.{3}$/', $apiKey)) {
            $newConfig->setApiKey($oldConfig->getApiKey());
        }

        return $newConfig;
    }
}
