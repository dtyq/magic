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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // 添加 attachments 字段，放在 tool 字段后面
            $table->json('attachments')->nullable()->comment('附件信息')->after('tool');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // 回滚时移除 attachments 字段
            $table->dropColumn('attachments');
        });
    }
};
