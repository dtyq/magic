<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateSuperMagicAgentsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_super_magic_agents', function (Blueprint $table) {
            $table->id();
            $table->string('organization_code', 50)->comment('组织代码');
            $table->string('code', 50)->unique()->comment('唯一编码');
            $table->string('name', 80)->default('')->comment('Agent名称');
            $table->string('description', 512)->default('')->comment('Agent描述');
            $table->string('icon', 100)->nullable()->default('')->comment('Agent图标');
            $table->tinyInteger('type')->default(2)->comment('智能体类型：1-内置，2-自定义');
            $table->boolean('enabled')->default(true)->comment('是否启用');
            $table->json('prompt')->comment('系统提示词');
            $table->string('creator', 40)->comment('创建者');
            $table->string('modifier', 40)->comment('修改者');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_code', 'creator'], 'idx_org_creator');
            $table->index(['organization_code', 'code'], 'idx_org_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_magic_agents');
    }
}
