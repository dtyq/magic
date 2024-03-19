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
        if (Schema::hasTable('magic_super_magic_agent_market')) {
            return;
        }

        Schema::create('magic_super_magic_agent_market', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->string('agent_code', 50)->comment('Agent 唯一标识码，对应 magic_super_magic_agent_versions.code');
            $table->bigInteger('agent_version_id')->comment('关联的 Agent 版本 ID，对应 magic_super_magic_agent_versions.id');
            $table->json('name_i18n')->nullable()->comment('多语言展示名称，格式：{"en":"xxx","zh":"xxx"}，必须包含 en');
            $table->json('description_i18n')->nullable()->comment('多语言展示描述，格式同 name_i18n');
            $table->json('role_i18n')->nullable()->comment('角色定位（多语言），格式：{"zh_CN":["市场分析师","内容创作者"],"en_US":["Marketing Analyst","Content Creator"]}');
            $table->json('icon')->nullable()->comment('Agent图标');
            $table->tinyInteger('icon_type')->default(1)->comment('图标类型: 1-图标, 2-图片');
            $table->string('publisher_id', 64)->comment('发布者用户 ID');
            $table->string('publisher_type', 32)->default('USER')->comment('发布者类型：USER=普通用户, OFFICIAL=官方运营, VERIFIED_CREATOR=认证创作者, PARTNER=第三方机构');
            $table->bigInteger('category_id')->nullable()->comment('分类 ID（预留字段，未来如有 Crew 分类表可关联）');
            $table->string('publish_status', 32)->default('UNPUBLISHED')->comment('发布状态：UNPUBLISHED=未发布, PUBLISHING=发布中, PUBLISHED=已发布, OFFLINE=已下架');
            $table->integer('install_count')->default(0)->comment('安装次数（统计有多少用户安装了该员工）');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['category_id'], 'idx_category_id');
            $table->index(['agent_version_id'], 'idx_agent_version_id');
            $table->index(['publisher_id'], 'idx_publisher_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
