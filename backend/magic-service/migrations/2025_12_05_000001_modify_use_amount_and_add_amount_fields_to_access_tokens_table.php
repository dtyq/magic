<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class ModifyUseAmountAndAddAmountFieldsToAccessTokensTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_api_access_tokens', function (Blueprint $table) {
            // 新增 cumulative_amount 字段
            $table->unsignedBigInteger('cumulative_amount')->comment('累计使用额度')->default(0)->after('use_amount');
            // 新增 amount_limit 字段
            $table->unsignedBigInteger('amount_limit')->comment('额度上限')->nullable()->default(null)->after('cumulative_amount');
            // 新增 available_amount 字段
            $table->unsignedBigInteger('available_amount')->comment('可用额度')->nullable()->default(null)->after('amount_limit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_api_access_tokens', function (Blueprint $table) {
            // 删除新增的字段
            $table->dropColumn(['cumulative_amount', 'amount_limit', 'available_amount']);
        });
    }
}
