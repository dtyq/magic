<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_super_magic_agent_playbooks')) {
            return;
        }

        Schema::create('magic_super_magic_agent_playbooks', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->string('organization_code', 64)->comment('归属组织编码');
            $table->bigInteger('agent_id')->comment('归属 Agent ID，对应 magic_super_magic_agents.id');
            $table->bigInteger('agent_version_id')->nullable()->comment('归属 Agent 版本 ID，对应 magic_super_magic_agent_versions.id，NULL 表示不属于特定版本');
            $table->string('agent_code', 50)->comment('Agent 代码标识，对应 magic_super_magic_agents.code，用于运行时识别 Agent');
            $table->json('name_i18n')->comment('Playbook 名称（多语言），格式：{"zh":"工作流标题","en":"Workflow Title"}');
            $table->json('description_i18n')->nullable()->comment('Playbook 描述（多语言），格式：{"zh":"...","en":"..."}');
            $table->string('icon', 64)->nullable()->comment('图标标识（emoji 或图标 key）');
            $table->string('theme_color', 32)->nullable()->comment('主题色，格式 #RRGGBB，如 #4F46E5');
            $table->tinyInteger('is_enabled')->default(1)->comment('启用状态：0=禁用(Disabled)，1=启用(Enabled)');
            $table->integer('sort_order')->default(0)->comment('展示排序权重，数值越大越靠前（对应原型图拖拽手柄）');
            $table->json('config')->nullable()->comment('Playbook 配置 JSON，包含 scenes_config、presets_config、quick_starts_config，格式：{"scenes_config":{...},"presets_config":{...},"quick_starts_config":[...]}，写入前须通过 Schema 校验（见文档附录）');
            $table->string('creator_id', 64)->comment('创建者用户 ID');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['agent_id'], 'idx_agent_id');
            $table->index(['agent_version_id'], 'idx_agent_version_id');
            $table->index(['agent_code'], 'idx_agent_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
