<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicDesignGenerationTasksTable extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('magic_design_generation_tasks')) {
            return;
        }

        Schema::create('magic_design_generation_tasks', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('任务ID');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('user_id', 64)->comment('用户ID');
            $table->bigInteger('project_id')->comment('项目ID');
            $table->string('generation_id', 64)->comment('生成任务业务ID');
            $table->string('asset_type', 32)->comment('资产类型');
            $table->string('generation_type', 32)->comment('生成类型');
            $table->string('model_id', 128)->comment('模型ID');
            $table->text('prompt')->comment('提示词');
            $table->string('file_dir', 1024)->default('')->comment('输出目录');
            $table->string('file_name', 255)->default('')->comment('输出文件名');
            $table->json('input_payload')->comment('原始输入快照');
            $table->json('request_payload')->comment('标准化请求快照');
            $table->json('provider_payload')->comment('下游执行上下文');
            $table->json('output_payload')->comment('最终输出快照');
            $table->string('status', 32)->default('pending')->comment('状态');
            $table->text('error_message')->nullable()->comment('错误信息');
            $table->timestamps();

            $table->unique(
                ['organization_code', 'project_id', 'asset_type', 'generation_id'],
                'uk_org_project_asset_generation'
            );
            $table->index(['status', 'id'], 'idx_status_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_design_generation_tasks');
    }
}
