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
        Schema::create('magic_bot_third_platform_chat', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('bot_id', 64)->default('')->comment('机器人ID');
            $table->string('key', 64)->comment('唯一标识')->unique();
            $table->string('type', 64)->default('')->comment('平台类型');
            $table->boolean('enabled')->default(true)->comment('是否启用');
            $table->text('options')->comment('配置');
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
