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
        Schema::create('magic_flow_api_keys', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code')->default('')->comment('组织编码');
            $table->string('code', 50)->default('')->comment('API Key编码')->index();
            $table->string('flow_code', 50)->default('')->comment('流程编码')->index();
            $table->string('conversation_id', 50)->default('')->comment('会话ID');
            $table->integer('type')->default(0)->comment('类型');
            $table->string('name')->default('')->comment('名称');
            $table->string('description')->default('')->comment('描述');
            $table->string('secret_key', 50)->default('')->comment('密钥')->unique();
            $table->boolean('enabled')->default(false)->comment('是否启用');
            $table->timestamp('last_used')->nullable()->comment('最后使用时间');
            $table->string('created_uid')->default('')->comment('创建者用户ID');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->string('updated_uid')->default('')->comment('更新者用户ID');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_api_keys');
    }
};
