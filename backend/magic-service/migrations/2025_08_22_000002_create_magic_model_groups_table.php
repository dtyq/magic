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
        if (Schema::hasTable('magic_mode_groups')) {
            return;
        }

        Schema::create('magic_mode_groups', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('mode_id')->unsigned()->default(0)->comment('模式ID');
            $table->json('name_i18n')->comment('分组名称国际化');
            $table->string('icon', 255)->default('')->comment('分组图标');
            $table->string('color', 10)->default('')->comment('分组颜色');
            $table->text('description')->comment('分组描述');
            $table->integer('sort')->default(0)->comment('排序权重');
            $table->tinyInteger('status')->default(1)->comment('状态 0:禁用 1:启用');
            $table->string('organization_code', 32)->default('')->comment('组织代码');
            $table->string('creator_id', 64)->default('')->comment('创建人ID');
            $table->timestamps();
            $table->softDeletes();
        });
    }
};
