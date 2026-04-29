<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * 为已有环境补充 Anthropic（仅 LLM）服务商定义；新环境若已由 ServiceProviderInitializer 写入则跳过.
     */
    public function up(): void
    {
        if (! Schema::hasTable('service_provider')) {
            return;
        }

        $exists = Db::table('service_provider')
            ->where('provider_code', 'Anthropic')
            ->where('category', 'llm')
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        $now = date('Y-m-d H:i:s');

        Db::table('service_provider')->insert([
            'name' => 'Anthropic',
            'provider_code' => 'Anthropic',
            'sort_order' => 993,
            'description' => 'Anthropic 提供 Claude 系列大语言模型，支持长上下文与多轮对话，适用于复杂推理与专业写作等场景。',
            'icon' => 'MAGIC/713471849556451329/default/default.png',
            'provider_type' => 0,
            'category' => 'llm',
            'status' => 1,
            'is_models_enable' => 0,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
            'translate' => json_encode([
                'name' => [
                    'en_US' => 'Anthropic',
                    'zh_CN' => 'Anthropic',
                ],
                'description' => [
                    'en_US' => 'Anthropic provides the Claude family of large language models with long context and multi-turn dialogue, suitable for complex reasoning and professional writing.',
                    'zh_CN' => 'Anthropic 提供 Claude 系列大语言模型，支持长上下文与多轮对话，适用于复杂推理与专业写作等场景。',
                ],
            ], JSON_UNESCAPED_UNICODE),
            'remark' => '',
        ]);
    }

    public function down(): void
    {
    }
};
