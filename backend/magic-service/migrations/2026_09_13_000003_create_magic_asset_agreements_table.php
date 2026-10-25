<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('magic_asset_agreements', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('organization_code', 32)->default('')->comment('组织编码');
            $table->string('user_id', 64)->comment('签署用户');
            $table->dateTime('accepted_at')->comment('签署时间');
            $table->dateTime('created_at');
            $table->dateTime('updated_at');
            $table->unique(['organization_code', 'user_id'], 'uniq_asset_agreement_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_asset_agreements');
    }
};
