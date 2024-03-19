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
        Schema::create('magic_mcp_user_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('user_id', 64)->comment('用户ID');
            $table->string('mcp_server_id', 80)->comment('MCP服务ID')->index();
            $table->json('require_fields')->nullable()->comment('必填字段');
            $table->json('oauth2_auth_result')->nullable()->comment('OAuth2认证结果');
            $table->json('additional_config')->nullable()->comment('附加配置');
            $table->string('creator', 64)->default('')->comment('创建者');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('modifier', 64)->default('')->comment('修改者');
            $table->dateTime('updated_at')->comment('更新时间');

            $table->index(['organization_code', 'user_id', 'mcp_server_id'], 'idx_org_user_mcp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
