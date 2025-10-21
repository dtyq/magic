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
     * 运行迁移.
     */
    public function up(): void
    {
        Schema::create('magic_organization_adminplus_whitelist', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 64)->comment('组织代码');
            $table->tinyInteger('enabled')->default(1)->comment('是否启用：1-启用 0-禁用');
            $table->timestamps();
            $table->softDeletes();

            $table->unique('organization_code', 'uk_org_code');
        });
    }

    /**
     * 回滚迁移.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_organization_adminplus_whitelist');

        echo '删除 magic_organization_adminplus_whitelist 表完成' . PHP_EOL;
    }
};
