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
        if (Schema::hasTable('magic_super_agent_task_files')) {
            return;
        }
        Schema::create('magic_super_agent_task_files', static function (Blueprint $table) {
            $table->bigIncrements('file_id')->comment('主键');
            $table->string('user_id', 128)->comment('user_id');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->bigInteger('topic_id')->comment('magic_general_agent_topics 的id');
            $table->bigInteger('task_id')->comment('magic_general_agent_task 的id');
            $table->string('file_type', 32)->default('')->comment('文件类型');
            $table->string('file_name', 256)->default('')->comment('文件名');
            $table->string('file_extension', 32)->default('')->comment('文件扩展名');
            $table->string('file_key', 255)->default('')->comment('文件存储路径');
            $table->unsignedBigInteger('file_size')->default(0)->comment('文件大小');
            $table->string('external_url', 1024)->default('')->comment('外链地址');
            $table->softDeletes();
            $table->timestamps();

            // 索引
            $table->index('topic_id', 'idx_topic_id');
            $table->index('task_id', 'idx_task_id');
            $table->index('user_id', 'idx_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_general_agent_task_files');
    }
};
