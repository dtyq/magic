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
     * 创建 MCP 标准授权凭据表。
     */
    public function up(): void
    {
        Schema::create('magic_mcp_authorization_credentials', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('user_id', 64)->comment('用户ID');
            $table->string('mcp_server_id', 80)->comment('MCP服务ID');
            $table->text('resource')->comment('受保护资源地址');
            $table->string('resource_hash', 64)->comment('受保护资源地址摘要');
            $table->text('issuer')->comment('授权服务器Issuer');
            $table->string('issuer_hash', 64)->comment('授权服务器Issuer摘要');
            $table->string('registration_mode', 32)->default('pre_registered')->comment('客户端注册方式');
            $table->text('client_id')->comment('OAuth客户端ID');
            $table->text('client_secret_ciphertext')->nullable()->comment('加密后的OAuth客户端密钥');
            $table->string('token_endpoint_auth_method', 64)->default('none')->comment('Token端点认证方式');
            $table->text('access_token_ciphertext')->comment('加密后的访问令牌');
            $table->text('refresh_token_ciphertext')->nullable()->comment('加密后的刷新令牌');
            $table->string('token_type', 32)->default('Bearer')->comment('令牌类型');
            $table->text('scope')->nullable()->comment('已授权Scope');
            $table->dateTime('expires_at')->nullable()->comment('访问令牌过期时间');
            $table->dateTime('refresh_token_expires_at')->nullable()->comment('刷新令牌过期时间');
            $table->json('discovery_metadata')->nullable()->comment('授权发现元数据快照');
            $table->json('client_metadata')->nullable()->comment('客户端注册元数据快照');
            $table->string('creator', 64)->default('')->comment('创建者');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('modifier', 64)->default('')->comment('修改者');
            $table->dateTime('updated_at')->comment('更新时间');

            $table->unique(
                ['organization_code', 'user_id', 'mcp_server_id', 'issuer_hash'],
                'uniq_mcp_auth_credential'
            );
            $table->index(
                ['organization_code', 'user_id', 'mcp_server_id', 'resource_hash'],
                'idx_mcp_auth_resource'
            );
        });
    }

    /**
     * 删除 MCP 标准授权凭据表。
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_mcp_authorization_credentials');
    }
};
