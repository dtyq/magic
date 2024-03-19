<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 定义 provider_code 到 sort_order 和名称的映射
        $providerMappings = [
            'Official' => [
                'sort_order' => 999, // Magic 排在最前面
                'name_zh_CN' => 'Magic',
                'name_en_US' => 'Magic',
            ],
            'MicrosoftAzure' => [
                'sort_order' => 998,
                'name_zh_CN' => 'Microsoft Azure',
                'name_en_US' => 'Microsoft Azure',
            ],
            'Google-Image' => [
                'sort_order' => 997,
                'name_zh_CN' => 'Google (AI Studio)',
                'name_en_US' => 'Google (AI Studio)',
            ],
            'Gemini' => [
                'sort_order' => 997,
                'name_zh_CN' => 'Google (AI Studio)',
                'name_en_US' => 'Google (AI Studio)',
            ],
            'AWSBedrock' => [
                'sort_order' => 996,
                'name_zh_CN' => 'Amazon Bedrock',
                'name_en_US' => 'Amazon Bedrock',
            ],
            'OpenRouter' => [
                'sort_order' => 995,
                'name_zh_CN' => 'OpenRouter',
                'name_en_US' => 'OpenRouter',
            ],
            'DashScope' => [
                'sort_order' => 994,
                'name_zh_CN' => '阿里云(百炼)',
                'name_en_US' => 'Aliyun (Bailian)',
            ],
            'Qwen' => [
                'sort_order' => 994,
                'name_zh_CN' => '阿里云 (百炼)',
                'name_en_US' => 'Amazon Bedrock',
            ],
            'Volcengine' => [
                'sort_order' => 993,
                'name_zh_CN' => '火山引擎',
                'name_en_US' => 'Volcengine',
            ],
            'VolcengineArk' => [
                'sort_order' => 993,
                'name_zh_CN' => '火山引擎(方舟)',
                'name_en_US' => 'Volcengine Ark',
            ],
            'DeepSeek' => [
                'sort_order' => 992,
                'name_zh_CN' => 'DeepSeek',
                'name_en_US' => 'DeepSeek',
            ],
            'OpenAI' => [
                'sort_order' => 991,
                'name_zh_CN' => '自定义提供商',
                'name_en_US' => 'Custom Provider',
            ],
            'MiracleVision' => [
                'sort_order' => 990,
                'name_zh_CN' => '美图奇想',
                'name_en_US' => 'MiracleVision',
            ],
        ];

        // 获取所有服务商记录
        $providers = Db::table('service_provider')
            ->whereNull('deleted_at')
            ->get()->toArray();

        foreach ($providers as $provider) {
            $providerCode = $provider['provider_code'];
            $providerId = $provider['id'];

            // 如果 provider_code 在映射中，则更新
            if (isset($providerMappings[$providerCode])) {
                $mapping = $providerMappings[$providerCode];

                // 获取现有的 translate 字段
                $translate = json_decode($provider['translate'] ?? '[]', true);
                if (! is_array($translate)) {
                    $translate = [];
                }

                // 更新 translate 中的名称
                if (! isset($translate['name'])) {
                    $translate['name'] = [];
                }
                $translate['name']['zh_CN'] = $mapping['name_zh_CN'];
                $translate['name']['en_US'] = $mapping['name_en_US'];

                // 更新数据库记录
                Db::table('service_provider')
                    ->where('id', $providerId)
                    ->update([
                        'name' => $mapping['name_zh_CN'], // 使用中文名称作为默认名称
                        'sort_order' => $mapping['sort_order'],
                        'translate' => json_encode($translate),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
            } else {
                // 如果不在映射中，设置默认排序值
                Db::table('service_provider')
                    ->where('id', $providerId)
                    ->update([
                        'sort_order' => 999,
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
