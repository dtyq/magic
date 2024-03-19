<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 创建文件集表.
 */
return new class extends Migration {
    /**
     * 运行迁移.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_file_collections')) {
            return;
        }

        Schema::create('magic_file_collections', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('created_uid', 64)->default('')->comment('创建者用户ID');
            $table->string('updated_uid', 64)->default('')->comment('更新者用户ID');
            $table->string('organization_code', 64)->comment('组织代码');
            $table->timestamps();
            $table->softDeletes();

            // 添加索引
            $table->index(['created_uid', 'organization_code']);
            $table->index('organization_code');
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_file_collections');
    }
};
