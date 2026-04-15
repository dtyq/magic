<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;

return new class extends Migration {
    public function up(): void
    {
        // Kept as a no-op to preserve migration history.
        // Index changes were split into dedicated migration files.
    }

    public function down(): void
    {
        // no-op
    }
};
