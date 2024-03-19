<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * 创建文件集项表.
 */
return new class extends Migration {
    /**
     * 运行迁移.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_file_collection_items')) {
            return;
        }

        Schema::create('magic_file_collection_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('collection_id')->comment('文件集ID');
            $table->string('file_id', 64)->comment('文件ID');
            $table->timestamps();
            $table->softDeletes();

            // 添加索引
            $table->index(['collection_id', 'file_id']);
            $table->index('collection_id');
            $table->index('file_id');
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_file_collection_items');
    }
};
