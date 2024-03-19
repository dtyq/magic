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
        if (Schema::hasTable('magic_super_magic_agent_versions')) {
            return;
        }

        Schema::create('magic_super_magic_agent_versions', function (Blueprint $table) {
            $table->bigInteger('id')->comment('主键 ID（版本ID，雪花ID）');
            $table->string('code', 50)->comment('Agent 唯一标识码，对应 magic_super_magic_agents.code，同一 Agent 的所有版本共享同一个 code');
            $table->string('organization_code', 50)->comment('归属组织编码');
            $table->string('version', 32)->comment('当前生效版本号，如 1.0.0');
            $table->string('name', 80)->default('')->comment('Agent 名称');
            $table->string('description', 512)->default('')->comment('Agent 描述');
            $table->text('icon')->nullable()->comment('Agent 图标');
            $table->tinyInteger('icon_type')->default(1)->comment('图标类型: 1-图标, 2-图片');
            $table->tinyInteger('type')->default(2)->comment('智能体类型: 1-内置, 2-自定义');
            $table->boolean('enabled')->default(true)->comment('是否启用');
            $table->json('prompt')->nullable()->comment('系统提示词');
            $table->json('tools')->nullable()->comment('工具列表');
            $table->string('creator', 40)->comment('创建者');
            $table->string('modifier', 40)->comment('修改者');
            $table->json('name_i18n')->comment('Agent 名称（多语言），格式：{"zh":"市场分析师","en":"Marketing Analyst"}');
            $table->json('role_i18n')->nullable()->comment('角色定位（多语言），格式：{"zh":["市场分析师","内容创作者"],"en":["Marketing Analyst","Content Creator"]}');
            $table->json('description_i18n')->nullable()->comment('核心职责与适用场景描述（多语言），格式：{"zh":"...","en":"..."}');
            $table->string('publish_status', 32)->default('UNPUBLISHED')->comment('发布状态：UNPUBLISHED=未发布, PUBLISHING=发布中, PUBLISHED=已发布, OFFLINE=已下架');
            $table->string('review_status', 32)->default('PENDING')->comment('审核状态：PENDING=待审核, UNDER_REVIEW=审核中, APPROVED=审核通过, REJECTED=审核拒绝');
            $table->bigInteger('project_id')->nullable()->comment('项目ID');
            $table->timestamps();
            $table->softDeletes();

            // 主键
            $table->primary('id');
            // 索引
            $table->index(['code'], 'idx_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
