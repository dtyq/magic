<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Factory;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition\Config\SpeechRecognitionConfig;
use App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition\VolcengineStandardClient;

class VolcengineStandardClientFactory
{
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService
    ) {
    }

    public function createVolcengineClient(): VolcengineStandardClient
    {
        $speechConfig = $this->getVolcengineConfig();
        return make(VolcengineStandardClient::class, ['config' => $speechConfig]);
    }

    public function getVolcengineConfig(): SpeechRecognitionConfig
    {
        // 从数据库读取音频文件识别配置
        // 配置示例（数组格式）：
        // [
        //     'providers' => [
        //         [
        //             'name' => 'Volcengine', // 火山引擎
        //             'provider' => 'Volcengine',
        //             'enable' => true,
        //             'app_key' => '',
        //             'access_key' => ''
        //         ]
        //     ]
        // ]
        $audioFileConfig = $this->aiAbilityDomainService->getProviderConfig(AiAbilityCode::AudioFileRecognition);
        $audioFileProviders = array_column($audioFileConfig['providers'] ?? [], null, 'provider');

        // 创建配置对象
        return make(SpeechRecognitionConfig::class, [
            'appKey' => $audioFileProviders['Volcengine']['app_key'] ?? '',
            'accessKey' => $audioFileProviders['Volcengine']['access_key'] ?? '',
            'cluster' => '',
        ]);
    }
}
