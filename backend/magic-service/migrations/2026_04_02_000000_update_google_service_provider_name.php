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
        $providerCodes = ['Gemini', 'Google-Image'];

        $providers = Db::table('service_provider')
            ->whereIn('provider_code', $providerCodes)
            ->whereNull('deleted_at')
            ->get()->toArray();

        foreach ($providers as $provider) {
            $providerId = $provider['id'];

            // 获取现有的 translate 字段
            $translate = json_decode($provider['translate'] ?? '[]', true);
            if (! is_array($translate)) {
                $translate = [];
            }

            // 更新 translate 中的名称
            if (! isset($translate['name'])) {
                $translate['name'] = [];
            }
            $translate['name']['zh_CN'] = 'Google';
            $translate['name']['en_US'] = 'Google';

            // 更新数据库记录
            Db::table('service_provider')
                ->where('id', $providerId)
                ->update([
                    'name' => 'Google',
                    'translate' => json_encode($translate, JSON_UNESCAPED_UNICODE),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
