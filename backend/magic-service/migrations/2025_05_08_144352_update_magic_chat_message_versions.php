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
        Schema::table('magic_chat_message_versions', function (Blueprint $table) {
            // message_type 字段，如果没有则添加
            if (! Schema::hasColumn('magic_chat_message_versions', 'message_type')) {
                $table->string('message_type', 64)->nullable()->comment('消息类型');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
