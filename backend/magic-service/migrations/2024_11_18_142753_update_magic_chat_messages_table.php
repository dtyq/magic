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
        Schema::table('magic_chat_messages', static function (Blueprint $table) {
            // 由于聚合搜索的存在，消息内容可能会很长，所以将字段类型改为longText
            $table->longText('content')->comment('消息详情。由于聚合搜索的存在，消息内容可能会很长，所以将字段类型改为longText')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_chat_messages', function (Blueprint $table) {
        });
    }
};
