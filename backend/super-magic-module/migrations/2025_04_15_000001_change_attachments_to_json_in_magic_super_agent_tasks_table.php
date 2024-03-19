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
        // 将 attachments 字段类型从 string(500) 改为 varchar(5000)
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            $table->string('attachments', 5000)->comment('用户上传的附件信息。用 json格式存储')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            // 回滚时将 attachments 字段类型改回原来的长度
            $table->string('attachments', 500)->comment('用户上传的附件信息。用 json格式存储')->change();
        });
    }
};
