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
        Schema::create('magic_mcp_servers', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->comment('组织编码');
            $table->string('code', 80)->unique()->comment('唯一编码');
            $table->string('name', 64)->default('')->comment('MCP服务名称');
            $table->string('description', 255)->default('')->comment('MCP服务描述');
            $table->string('icon', 255)->default('')->comment('MCP服务图标');
            $table->string('type', 16)->default('sse')->comment('服务类型: sse或stdio');
            $table->boolean('enabled')->default(false)->comment('是否启用: 0-禁用, 1-启用');
            $table->string('creator', 64)->default('')->comment('创建者');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('modifier', 64)->default('')->comment('修改者');
            $table->dateTime('updated_at')->comment('更新时间');
            $table->softDeletes();

            $table->unique(['organization_code', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_mcp_servers');
    }
};
