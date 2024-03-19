<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class CreateMagicApiAccessTokenTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_api_access_tokens', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('access_token')->comment('accessToken');
            $table->string('name')->comment('名称');
            $table->string('models')->comment('模型id，多个用，分割')->nullable();
            $table->string('ip_limit')->comment('限制ip，多个用，分割')->nullable();
            $table->timestamp('expire_time')->comment('过期时间')->nullable();
            $table->unsignedDecimal('total_amount', 40, 6)->comment('使用额度');
            $table->unsignedDecimal('use_amount', 40, 6)->comment('使用额度')->default(0);
            $table->string('organization_code')->comment('组织id');
            $table->string('user_id')->comment('用户id');
            $table->timestamp('created_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('创建时间');
            $table->timestamp('updated_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('修改时间')->nullable();
            $table->timestamp('deleted_at')->comment('逻辑删除')->nullable();
            $table->string('creator')->comment('创建人')->nullable();
            $table->string('modifier')->comment('修改人');
            // 唯一键索引
            $table->unique('access_token');
            // 以下的索引是为了数据统计
            // userid索引
            $table->index('user_id');
            // creator索引
            $table->index('creator');
            // organization_code索引
            $table->index('organization_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_access_token');
    }
}
