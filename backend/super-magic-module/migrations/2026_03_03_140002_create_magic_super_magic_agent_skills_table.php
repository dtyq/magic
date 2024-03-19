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
        if (Schema::hasTable('magic_super_magic_agent_skills')) {
            return;
        }

        Schema::create('magic_super_magic_agent_skills', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->string('organization_code', 50)->comment('归属组织编码');
            $table->bigInteger('agent_id')->comment('关联的 Agent ID，对应 magic_super_magic_agents.id');
            $table->bigInteger('agent_version_id')->nullable()->comment('关联的 Agent 版本 ID，对应 magic_super_magic_agent_versions.id，NULL 表示不属于特定版本');
            $table->string('agent_code', 50)->comment('Agent 代码标识，对应 magic_super_magic_agents.code，用于运行时识别 Agent');
            $table->bigInteger('skill_id')->comment('关联的 Skill ID，对应 magic_skills.id');
            $table->bigInteger('skill_version_id')->nullable()->comment('关联的 Skill 版本 ID，对应 magic_skill_versions.id');
            $table->string('skill_code', 128)->comment('Skill 代码标识，对应 skill_version.code，用于运行时识别 Skill');
            $table->integer('sort_order')->default(0)->comment('Skill 在 Agent 中的展示排序，数值越小越靠前');
            $table->string('creator_id', 64)->comment('绑定操作人用户 ID');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['agent_id'], 'idx_agent_id');
            $table->index(['agent_version_id'], 'idx_agent_version_id');
            $table->index(['agent_code'], 'idx_agent_code');
            $table->index(['skill_id'], 'idx_skill_id');
            $table->index(['skill_version_id'], 'idx_skill_version_id');
            $table->index(['skill_code'], 'idx_skill_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
