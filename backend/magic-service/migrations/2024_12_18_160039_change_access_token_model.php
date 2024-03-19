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
        Schema::table('magic_api_access_tokens', function (Blueprint $table) {
            $table->string('user_id')->default('')->comment('用户id')->change();
            $table->string('type', 20)->default('user')->comment('类型')->after('access_token');
            $table->string('relation_id', 255)->default('')->comment('关联ID')->after('type');
            $table->string('description', 255)->default('')->comment('描述');
            $table->integer('rpm')->default(0)->comment('限流');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
