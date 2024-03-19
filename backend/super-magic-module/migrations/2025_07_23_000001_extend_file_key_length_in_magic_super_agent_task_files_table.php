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
        if (! Schema::hasTable('magic_super_agent_task_files')) {
            return;
        }

        Schema::table('magic_super_agent_task_files', static function (Blueprint $table) {
            // 扩展 file_key 字段长度从 varchar(255) 到 varchar(500)
            // 500字符 × 4字节 = 2000字节，远小于索引键长度限制3072字节
            $table->string('file_key', 500)->default('')->change()->comment('文件存储路径（扩展长度）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_super_agent_task_files')) {
            return;
        }

        Schema::table('magic_super_agent_task_files', static function (Blueprint $table) {
            // 回滚：将 file_key 字段长度从 varchar(500) 恢复到 varchar(255)
            $table->string('file_key', 255)->default('')->change()->comment('文件存储路径');
        });
    }
};
