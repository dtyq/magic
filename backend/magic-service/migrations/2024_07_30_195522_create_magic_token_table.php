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
        if (Schema::hasTable('magic_tokens')) {
            return;
        }
        Schema::create('magic_tokens', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('type')->default(0)->comment('token类型. 0:账号,1:用户,2:组织,3:应用,4:流程');
            $table->string('type_relation_value', 64)->comment(
                'token类型对应的值.类型为0时,此值为account_id;类型为1时,此值为user_id;类型为2时,此值为组织编码;类型为3时,此值为app_id;类型为4时,此值为flow_id'
            );
            $table->string('token', 256)->comment('token的值,全局唯一');
            $table->timestamp('expired_at')->comment('过期时间');
            $table->unique(['token'], 'idx_token');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_tokens');
    }
};
