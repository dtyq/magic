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

        $exists = Db::table('service_provider')
            ->where('provider_code', 'MiniMax')
            ->where('category', 'vgm')
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        $now = date('Y-m-d H:i:s');

        Db::table('service_provider')->insert([
            'name' => 'MiniMax',
            'provider_code' => 'MiniMax',
            'sort_order' => 1000,
            'description' => 'MiniMax 提供视频生成模型服务，支持文生视频、首尾帧和多模态参考视频创作场景。',
            'icon' => 'MAGIC/713471849556451329/default/magic.png',
            'provider_type' => 0,
            'category' => 'vgm',
            'status' => 1,
            'is_models_enable' => 1,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
            'translate' => json_encode([
                'name' => [
                    'en_US' => 'MiniMax',
                    'zh_CN' => 'MiniMax',
                ],
                'alias' => [
                    'en_US' => 'MiniMax',
                    'zh_CN' => 'MiniMax',
                ],
                'description' => [
                    'en_US' => 'MiniMax provides video generation model services for text-to-video, keyframe-guided, and multimodal reference creation scenarios.',
                    'zh_CN' => 'MiniMax 提供视频生成模型服务，支持文生视频、首尾帧和多模态参考视频创作场景。',
                ],
            ], JSON_UNESCAPED_UNICODE),
            'remark' => 'MiniMax',
        ]);
    }

    public function down(): void
    {
    }
};
