<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Support\Composer;
use Psr\Container\ContainerInterface;

#[Command]
class MigrateVendorCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('migrate:vendor');
        $this->description = 'vendor 迁移';
    }

    public function handle(): void
    {
        $vendors = Composer::getMergedExtra();
        foreach ($vendors as $vendorName => $extra) {
            $paths = $extra['hyperf']['migrate']['paths'] ?? [];
            if (empty($paths)) {
                continue;
            }
            $prefix = "vendor/{$vendorName}";
            foreach ($paths as $path) {
                if (! str_starts_with($path, $prefix)) {
                    $path = $prefix . '/' . $path;
                }
                $this->migrate($path);
                $this->line("migrate: {$path}");
            }
        }
    }

    private function migrate(string $path): void
    {
        $this->call('migrate', [
            '--path' => $path,
            '--force' => true,
        ]);
    }
}
