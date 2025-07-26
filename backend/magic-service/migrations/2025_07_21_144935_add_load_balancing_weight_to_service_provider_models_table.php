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
        Schema::table('service_provider_models', function (Blueprint $table) {
            $table->tinyInteger('load_balancing_weight')
                ->nullable()
                ->default(null)
                ->comment('负载均衡权重(0-100)');
        });
    }
};
