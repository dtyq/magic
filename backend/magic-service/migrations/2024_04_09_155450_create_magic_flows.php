<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicFlows extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_flows', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('唯一标识符');
            $table->string('code')->default('')->comment('流程编码');
            $table->string('version_code')->default('')->comment('版本编码');
            $table->string('name')->default('')->comment('流程名称');
            $table->string('description')->default('')->comment('流程描述');
            $table->string('icon')->default('')->comment('流程图标');
            $table->integer('type')->default(0)->comment('流程类型');
            $table->json('edges')->comment('流程边缘信息');
            $table->json('nodes')->comment('流程节点信息');
            $table->boolean('enabled')->default(true)->comment('流程是否启用');
            $table->string('organization_code')->default('')->comment('组织代码');
            $table->string('created_uid')->default('')->comment('创建者用户ID');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->string('updated_uid')->default('')->comment('更新者用户ID');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');

            $table->index('code');
            $table->index(['organization_code', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flows');
    }
}
