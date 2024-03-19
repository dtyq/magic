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
        if (Schema::hasTable('magic_skill_market')) {
            return;
        }
        Schema::create('magic_skill_market', static function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->string('skill_code', 64)->comment('Skill 唯一标识码，对应 magic_skill_versions.code');
            $table->bigInteger('skill_version_id')->comment('关联的 Skill 版本 ID，对应 magic_skill_versions.id');
            $table->json('name_i18n')->nullable()->comment('多语言展示名称，格式：{"en":"xxx","zh":"xxx"}，必须包含 en');
            $table->json('description_i18n')->nullable()->comment('多语言展示描述，格式同 name_i18n');
            $table->string('logo', 512)->nullable()->comment('Logo 图片 URL');
            $table->string('publisher_id', 64)->comment('发布者用户 ID');
            $table->string('publisher_type', 32)->default('USER')->comment('发布者类型：USER=普通用户, OFFICIAL=官方运营, VERIFIED_CREATOR=认证创作者, PARTNER=第三方机构');
            $table->bigInteger('category_id')->nullable()->comment('分类 ID，对应 magic_skill_categories.id');
            $table->string('publish_status', 32)->default('UNDER_REVIEW')->comment('发布状态：UNDER_REVIEW=审核中, PUBLISHED=已发布, OFFLINE=已下架');
            $table->integer('install_count')->default(0)->comment('安装次数（统计有多少用户安装了该技能）');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->unique(['skill_version_id'], 'uk_skill_version_id');
            $table->index(['skill_code'], 'idx_skill_code');
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
