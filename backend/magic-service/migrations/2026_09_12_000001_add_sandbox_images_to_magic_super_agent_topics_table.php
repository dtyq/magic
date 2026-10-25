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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_topics', 'sandbox_images')) {
                $table->json('sandbox_images')->nullable()->default(null)
                    ->comment('Canonical sandbox Agent and AGFS images; replaces legacy agent_image')
                    ->after('agent_image');
            }
        });
    }

    public function down(): void
    {
    }
};
