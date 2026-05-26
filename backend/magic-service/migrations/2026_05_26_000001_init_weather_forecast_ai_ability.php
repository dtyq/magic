<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Application\Provider\Official\AiAbilityInitializer;
use Hyperf\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        AiAbilityInitializer::init();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // weather_forecast 能力记录由 initializeAbilities 幂等管理，无需回滚
    }
};
