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
        Schema::create('magic_api_applications', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('code', 64)->default('')->comment('编码');
            $table->string('name', 64)->default('')->comment('名称');
            $table->string('description', 255)->default('')->comment('描述');
            $table->string('icon', 255)->default('')->comment('图标');
            $table->string('created_uid', 80)->default('')->comment('创建人');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('updated_uid', 80)->default('')->comment('修改人');
            $table->dateTime('updated_at')->comment('修改时间');
            $table->softDeletes();

            $table->unique(['organization_code', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_applications');
    }
};
