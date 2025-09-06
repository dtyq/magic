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
     * 运行迁移.
     */
    public function up(): void
    {
        // 创建配额表
        Schema::create('billing_manager_quotas', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('target_id', 50)->nullable()->comment('目标ID（用户ID或组织代码）');
            $table->string('target_type', 20)->default('user')->comment('目标类型: user或organization');
            $table->string('quota_type', 50)->comment('配额类型');
            $table->unsignedBigInteger('used')->default(0)->comment('已使用配额');
            $table->unsignedBigInteger('remaining')->default(0)->comment('剩余配额');
            $table->timestamp('expires_at')->nullable()->comment('过期时间');
            $table->softDeletes();
            $table->timestamps();

            // 组合索引
            $table->index(['target_id', 'target_type', 'quota_type'], 'idx_target_id_target_type_quota_type');
        });

        // 创建配额记录表
        Schema::create('billing_manager_quotas_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('target_id', 50)->nullable()->comment('目标ID（用户ID或组织代码）');
            $table->string('target_type', 20)->default('user')->comment('目标类型: user或organization');
            $table->string('rule_name', 128)->comment('策略主键');
            $table->string('quota_type', 50)->comment('配额类型');
            $table->bigInteger('amount')->default(0)->comment('消费量');
            $table->string('description')->nullable()->comment('描述');
            $table->json('extent_attribute')->nullable()->comment('扩展属性JSON');
            $table->softDeletes();
            $table->timestamps();

            // 组合索引
            $table->index(['target_id', 'target_type', 'quota_type'], 'idx_target_id_target_type_quota_type');
            // created_at
            $table->index(['created_at', 'target_id', 'target_type'], 'idx_created_at_target_id_target_type');
        });

        // 创建规则表
        Schema::create('billing_manager_rules', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 128)->comment('规则名称');
            $table->string('rule_group_name', 128)->comment('规则组名称');
            $table->string('description')->nullable()->comment('规则描述');
            $table->string('quota_type', 50)->comment('配额类型');
            $table->unsignedBigInteger('amount')->nullable()->comment('配额量');
            $table->boolean('is_active')->default(true)->comment('是否启用');
            $table->string('applies_to', 20)->default('user')->comment('适用对象（用户、组织、两者）');
            $table->json('conditions')->nullable()->comment('条件（JSON格式）');
            $table->string('operation')->default('add')->comment('操作类型');
            $table->boolean('limit')->default(false)->comment('是否是上限配置，true则设置limit，false则设置remaining');
            $table->integer('expire_type')->default(4)->comment('过期类型: 1-当天有效,2-当月有效,3-当年有效,4-永久有效');
            $table->string('crontab', 100)->nullable()->comment('定时执行表达式，如0 0 * * *表示每天0点执行');
            $table->softDeletes();
            $table->timestamps();
            // name 索引
            $table->unique('name', 'unique_rule_name');
        });

        // 创建规则组表
        Schema::create('billing_manager_rule_groups', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 128)->comment('规则组名称');
            $table->json('rule_name_list')->nullable()->comment('规则名称列表（JSON格式）');
            $table->integer('priority')->default(0)->comment('规则组优先级');
            $table->softDeletes();
            $table->timestamps();
            // 添加索引
            $table->unique('name', 'unique_rule_group_name');
        });

        // 创建规则组与目标绑定表
        Schema::create('billing_manager_rule_group_target_binding', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('target_id', 50)->nullable()->comment('目标ID（用户ID或组织代码）');
            $table->string('target_type', 20)->default('user')->comment('目标类型: user或organization');
            $table->string('rule_group_name', 128)->nullable()->comment('规则组名称');
            $table->integer('priority')->default(0)->comment('绑定优先级');
            $table->tinyInteger('enable')->default(1)->comment('是否启用: 0-不启用, 1-启用');
            // 过期时间
            $table->timestamp('expires_at')->nullable()->comment('套餐过期时间');
            $table->softDeletes();
            $table->timestamps();

            // 添加索引以便于查询
            $table->unique(['target_id', 'target_type', 'rule_group_name'], 'unique_target_rule_group');
            $table->index(['rule_group_name'], 'idx_rule_group_name');
        });

        // 创建额外规则绑定表
        Schema::create('billing_manager_additional_rule_binding', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('target_id', 50)->nullable()->comment('目标ID（用户ID或组织代码）');
            $table->string('target_type', 20)->default('user')->comment('目标类型: user或organization');
            $table->string('rule_name', 128)->comment('规则名称');
            $table->boolean('is_active')->default(true)->comment('是否启用');
            $table->integer('priority')->default(0)->comment('规则的优先级');
            $table->softDeletes();
            $table->timestamps();

            $table->index(['rule_name'], 'idx_rule_name');
            $table->index(['target_id', 'target_type'], 'idx_target_id_type');
        });

        // 创建规则执行历史表
        Schema::create('billing_manager_rule_execution_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('rule_name', 255)->comment('规则名称');
            $table->string('target_id', 255)->comment('目标ID（用户ID或组织ID）');
            $table->string('target_type', 50)->comment('目标类型（用户/组织）');
            $table->string('crontab', 100)->comment('定时执行表达式，如0 0 * * *表示每天0点执行');
            $table->integer('actual_execute_times')->comment('历史执行次数');
            $table->timestamp('last_execution_time')->nullable()->comment('上次执行时间');
            $table->softDeletes();
            $table->timestamps();

            $table->unique(['rule_name', 'target_id', 'target_type'], 'udx_rule_target');
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::dropIfExists('billing_manager_rule_execution_history');
        Schema::dropIfExists('billing_manager_additional_rule_binding');
        Schema::dropIfExists('billing_manager_rule_group_target_binding');
        Schema::dropIfExists('billing_manager_rule_group_rule_binding');
        Schema::dropIfExists('billing_manager_rule_groups');
        Schema::dropIfExists('billing_manager_rules');
        Schema::dropIfExists('billing_manager_quotas_records');
        Schema::dropIfExists('billing_manager_quotas');
    }
};
