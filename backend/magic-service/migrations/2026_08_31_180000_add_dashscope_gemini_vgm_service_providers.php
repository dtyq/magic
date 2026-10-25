<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('service_provider')) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $providers = [
            [
                'name' => '阿里云(百炼)',
                'provider_code' => 'DashScope',
                'description' => '阿里云百炼提供 Wan 系列视频生成模型服务，支持文生视频、图生视频等创作场景。',
                'translate' => [
                    'name' => ['en_US' => 'Aliyun (Bailian)', 'zh_CN' => '阿里云(百炼)'],
                    'alias' => ['en_US' => 'Aliyun (Bailian)', 'zh_CN' => '阿里云(百炼)'],
                    'description' => [
                        'en_US' => 'Alibaba Cloud Bailian provides Wan video generation models for text-to-video and image-to-video creation scenarios.',
                        'zh_CN' => '阿里云百炼提供 Wan 系列视频生成模型服务，支持文生视频、图生视频等创作场景。',
                    ],
                ],
                'remark' => 'Wan 视频生成',
            ],
            [
                'name' => 'Google Gemini',
                'provider_code' => 'Gemini',
                'description' => 'Google Gemini 提供视频生成模型服务，支持文本和参考素材驱动的视频创作场景。',
                'translate' => [
                    'name' => ['en_US' => 'Google Gemini', 'zh_CN' => 'Google Gemini'],
                    'alias' => ['en_US' => 'Google Gemini', 'zh_CN' => 'Google Gemini'],
                    'description' => [
                        'en_US' => 'Google Gemini provides video generation model services for text and reference-material-driven video creation scenarios.',
                        'zh_CN' => 'Google Gemini 提供视频生成模型服务，支持文本和参考素材驱动的视频创作场景。',
                    ],
                ],
                'remark' => 'Gemini 视频生成',
            ],
        ];

        foreach ($providers as $provider) {
            $exists = Db::table('service_provider')
                ->where('provider_code', $provider['provider_code'])
                ->where('category', 'vgm')
                ->whereNull('deleted_at')
                ->exists();

            if ($exists) {
                continue;
            }

            Db::table('service_provider')->insert([
                'name' => $provider['name'],
                'provider_code' => $provider['provider_code'],
                'sort_order' => 1000,
                'description' => $provider['description'],
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'provider_type' => 0,
                'category' => 'vgm',
                'status' => 1,
                'is_models_enable' => 1,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
                'translate' => json_encode($provider['translate'], JSON_UNESCAPED_UNICODE),
                'remark' => $provider['remark'],
            ]);
        }
    }

    public function down(): void
    {
    }
};
