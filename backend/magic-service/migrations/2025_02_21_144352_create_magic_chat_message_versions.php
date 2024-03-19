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
        if (Schema::hasTable('magic_chat_message_versions')) {
            return;
        }
        Schema::create('magic_chat_message_versions', function (Blueprint $table) {
            $table->bigIncrements('version_id');
            $table->string('magic_message_id', 64)->comment('magic_chat_message 表的 magic_message_id');
            $table->longText('message_content')->comment('消息内容');
            $table->index(['magic_message_id', 'version_id'], 'idx_magic_message_id_version_id');
            $table->timestamps();
            $table->comment('消息版本表,记录消息的版本信息');
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_message_versions');
    }
};
