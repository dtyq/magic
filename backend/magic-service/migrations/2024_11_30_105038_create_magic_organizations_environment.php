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
        Schema::create('magic_organizations_environment', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('login_code', 32)->comment('登录码，用于关联组织和环境，可以在登录时手动填写。长度较短，便于记忆');
            $table->string('magic_organization_code', 32)->comment('麦吉组织 code');
            $table->string('origin_organization_code', 32)->comment('原始组织 code');
            // 环境id
            $table->unsignedBigInteger('environment_id')->comment('magic_environment表的id。表明这个组织要使用哪个环境');
            $table->unique('login_code', 'idx_login_code');
            $table->unique('magic_organization_code', 'idx_magic_organization_code');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_organizations_environment');
    }
};
