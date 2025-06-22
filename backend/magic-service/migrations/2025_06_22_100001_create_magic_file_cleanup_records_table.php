<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class CreateMagicFileCleanupRecordsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_file_cleanup_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 50)->comment('组织编码');
            $table->string('file_key', 500)->comment('文件存储key');
            $table->string('file_name', 255)->comment('文件名称');
            $table->unsignedBigInteger('file_size')->default(0)->comment('文件大小(字节)');
            $table->string('bucket_type', 20)->default('private')->comment('存储桶类型');
            $table->string('source_type', 50)->comment('来源类型(batch_compress,upload_temp等)');
            $table->string('source_id', 100)->nullable()->comment('来源ID(可选的业务标识)');
            $table->timestamp('expire_at')->comment('过期时间');
            $table->tinyInteger('status')->default(0)->comment('状态:0=待清理,1=已清理,2=清理失败');
            $table->tinyInteger('retry_count')->default(0)->comment('重试次数');
            $table->text('error_message')->nullable()->comment('错误信息');
            $table->timestamp('created_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('创建时间');
            $table->timestamp('updated_at')->default(Db::raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))->comment('更新时间');

            $table->index(['expire_at', 'status'], 'idx_expire_status');
            $table->index(['organization_code'], 'idx_organization_code');
            $table->index(['source_type'], 'idx_source_type');
            $table->index(['created_at'], 'idx_created_at');
            $table->index(['file_key', 'organization_code'], 'idx_file_key_org');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_file_cleanup_records');
    }
}
