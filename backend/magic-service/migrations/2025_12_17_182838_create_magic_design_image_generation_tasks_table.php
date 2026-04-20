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
        // 表存在就不执行
        if (Schema::hasTable('magic_design_image_generation_tasks')) {
            return;
        }

        Schema::create('magic_design_image_generation_tasks', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('任务ID');

            // 用户信息
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('user_id', 64)->comment('用户ID');

            // 项目和图片标识
            $table->bigInteger('project_id')->comment('项目ID');
            $table->string('image_id', 80)->comment('图片ID（全局唯一）');

            // 生图配置
            $table->string('model_id', 80)->comment('模型ID');
            $table->string('prompt', 1024)->comment('提示词');
            $table->string('size', 50)->nullable()->comment('图片尺寸，如: 1:1, 1024x1024');
            $table->string('file_dir', 512)->comment('输出文件目录');
            $table->string('file_name', 255)->default('')->comment('输出文件名（含扩展名），生成完成后填写');
            $table->json('reference_images')->nullable()->comment('参考图路径数组（图生图）');

            // 任务状态
            $table->string('status', 10)->default('pending')->comment('状态: pending/processing/completed/failed');
            $table->string('error_message', 512)->nullable()->comment('错误信息');

            $table->timestamps();

            // 索引
            $table->unique(['organization_code', 'project_id', 'image_id'], 'uk_project_image');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_design_image_generation_tasks');
    }
};
