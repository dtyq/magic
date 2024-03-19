<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\CircuitBreakerStatus;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 表存在就不执行
        if (Schema::hasTable('magic_api_premium_endpoints')) {
            return;
        }

        Schema::create('magic_api_premium_endpoints', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('type', 255)->comment('接入点类型。用户需要自己保证不与其他业务重复');
            $table->string('provider', 255)->comment('提供商')->nullable();
            $table->string('name', 255)->comment('接入点名称');
            $table->text('config')->comment('让用户自己存一些配置信息')->nullable();
            $table->tinyInteger('enabled')->default(1)->comment('是否启用: 1=启用, 0=禁用');
            $table->string('circuit_breaker_status', 32)
                ->default(CircuitBreakerStatus::CLOSED->value)
                ->comment('熔断状态: closed=正常服务中, open=熔断中, half_open=尝试恢复中');
            $table->string('resources', 255)->comment('资源的消耗 id 列表，一次请求可能消耗多种资源')->nullable();
            $table->datetimes();
            $table->unique(['enabled', 'type', 'provider', 'name'], 'unique_enabled_type_provider_name');
            $table->comment('API接入点表，关联了接入点的可消耗资源信息');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_premium_endpoints');
    }
};
