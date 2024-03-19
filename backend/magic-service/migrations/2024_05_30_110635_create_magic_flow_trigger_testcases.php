<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicFlowTriggerTestcases extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_flow_trigger_testcases', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('flow_code')->default('')->comment('所属流程编码');
            $table->string('code')->default('')->comment('测试集编码');
            $table->string('name')->default('')->comment('测试集名称');
            $table->string('description')->default('')->comment('测试集描述');
            $table->json('case_config')->nullable(false)->comment('用例配置');
            $table->string('organization_code')->default('')->comment('组织代码');
            $table->string('created_uid')->default('')->comment('创建者用户ID');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->string('updated_uid')->default('')->comment('更新者用户ID');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');

            $table->index(['flow_code', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_trigger_testcase');
    }
}
