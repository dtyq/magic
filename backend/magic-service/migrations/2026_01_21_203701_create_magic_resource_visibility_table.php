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
        if (Schema::hasTable('magic_resource_visibility')) {
            return;
        }
        Schema::create('magic_resource_visibility', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 50)->comment('组织代码（SaaS多租户隔离）');

            // 主体（谁拥有权限）
            $table->tinyInteger('principal_type')->comment('主体类型: 1-用户, 2-部门, 3-组织');
            $table->string('principal_id', 50)->comment('主体ID');

            // 客体（对什么有权限）
            $table->tinyInteger('resource_type')->comment('资源类型: 1-自定义Agent, 可拓展');
            $table->string('resource_code', 50)->comment('资源唯一编码（如 agent_code）');

            $table->string('creator', 40)->comment('创建者');
            $table->string('modifier', 40)->comment('修改者');
            $table->timestamps();

            // 唯一约束：防止重复授权
            $table->unique(
                ['organization_code', 'principal_type', 'principal_id', 'resource_type', 'resource_code'],
                'uk_org_principal_resource'
            );

            $table->comment('资源可见性表（支持 Agent等等，主体为用户/部门/组织）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_resource_visibility');
    }
};
