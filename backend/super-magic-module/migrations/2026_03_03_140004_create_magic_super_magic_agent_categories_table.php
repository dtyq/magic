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
        if (Schema::hasTable('magic_super_magic_agent_categories')) {
            return;
        }

        Schema::create('magic_super_magic_agent_categories', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID');
            $table->string('organization_code', 64)->comment('归属组织编码');
            $table->json('name_i18n')->comment('分类名称（多语言），格式：{"zh":"营销场景","en":"Marketing Scenes"}');
            $table->string('logo', 512)->nullable()->comment('Logo 图片 URL');
            $table->integer('sort_order')->default(0)->comment('排序权重，数值越大越靠前');
            $table->string('creator_id', 64)->comment('创建者用户 ID');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index(['organization_code', 'sort_order', 'created_at'], 'idx_org_sort');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
