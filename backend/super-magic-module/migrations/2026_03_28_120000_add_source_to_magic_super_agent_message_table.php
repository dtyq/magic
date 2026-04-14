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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_message', 'source')) {
                return;
            }

            $table->json('source')->nullable()->after('usage');
        });
    }

    public function down(): void
    {
    }
};
