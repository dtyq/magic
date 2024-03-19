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
        Schema::create('magic_applications', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键ID');
            $table->json('name_i18n')->comment('应用名称国际化');
            $table->string('icon', 255)->default('')->comment('应用图标标识');
            $table->string('icon_url', 255)->default('')->comment('应用图标图片地址');
            $table->tinyInteger('icon_type')->default(1)->comment('图标类型: 1-图标, 2-图片');
            $table->string('path', 255)->default('')->comment('应用路径（菜单链接）');
            $table->tinyInteger('open_method')->default(1)->comment('打开方式: 1-当前窗口, 2-新窗口');
            $table->integer('sort_order')->default(0)->comment('排序（展示优先级，数值越大越靠前）');
            $table->tinyInteger('display_scope')->default(2)->comment('可见范围: 0-仅企业/团队, 1-仅个人, 2-所有可见');
            $table->tinyInteger('status')->default(1)->comment('状态: 1-正常, 2-禁用');
            $table->string('creator_id', 64)->default('')->comment('创建人ID');
            $table->dateTime('created_at')->comment('创建时间');
            $table->dateTime('updated_at')->comment('更新时间');
            $table->softDeletes()->comment('删除时间');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_applications');
    }
};
