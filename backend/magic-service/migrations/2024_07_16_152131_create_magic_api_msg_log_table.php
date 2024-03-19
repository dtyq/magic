<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class CreateMagicApiMsgLogTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_api_msg_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->text('msg')->comment('消息');
            $table->unsignedDecimal('use_amount', 40, 6)->comment('使用额度');
            $table->string('model')->comment('使用模型id');
            $table->string('organization_code')->comment('组织id');
            $table->string('user_id')->comment('用户id');
            $table->timestamp('created_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('创建时间');
            $table->timestamp('updated_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('修改时间')->nullable();
            $table->timestamp('deleted_at')->comment('逻辑删除')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_msg_log');
    }
}
