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
        Schema::create('magic_mcp_server_tools', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->comment('组织编码');
            $table->string('mcp_server_code', 80)->comment('关联的 mcp 服务 code')->index();
            $table->string('name', 64)->default('')->comment('工具名称');
            $table->string('description', 512)->default('')->comment('工具描述');
            $table->tinyInteger('source')->default(0)->comment('工具来源');
            $table->string('rel_code', 80)->default('')->comment('关联的工具 code');
            $table->string('rel_version_code', 80)->default('')->comment('关联的工具版本 code');
            $table->json('rel_info')->nullable()->comment('关联的信息');
            $table->string('version', 80)->default('')->comment('工具版本');
            $table->boolean('enabled')->default(false)->comment('是否启用: 0-禁用, 1-启用');
            $table->json('options')->nullable()->comment('工具配置 name、description、inputSchema');
            $table->string('creator', 64)->default('')->comment('创建者');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('modifier', 64)->default('')->comment('修改者');
            $table->dateTime('updated_at')->comment('更新时间');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_mcp_server_tools');
    }
};
