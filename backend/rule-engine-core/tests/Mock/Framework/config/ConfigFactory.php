<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Mock\Framework\config;

use Hyperf\Config\Config;
use Hyperf\Config\ConfigFactory as HyperfConfigFactory;
use Hyperf\Config\ProviderConfig;
use Psr\Container\ContainerInterface;
use Symfony\Component\Finder\Finder;

class ConfigFactory extends HyperfConfigFactory
{
    public function __invoke(ContainerInterface $container)
    {
        $configPath = BASE_MOCK_PATH . '/App/config';
        $config = $this->readConfig($configPath . '/config.php');
        $autoloadConfig = $this->readPaths([$configPath . '/autoload']);
        $merged = array_merge_recursive(ProviderConfig::load(), $config, ...$autoloadConfig);
        return new Config($merged);
    }

    private function readConfig(string $configPath): array
    {
        $config = [];
        if (file_exists($configPath) && is_readable($configPath)) {
            $config = require $configPath;
        }
        return is_array($config) ? $config : [];
    }

    private function readPaths(array $paths): array
    {
        $configs = [];
        $finder = new Finder();
        $finder->files()->in($paths)->name('*.php');
        foreach ($finder as $file) {
            $configs[] = [
                $file->getBasename('.php') => require $file->getRealPath(),
            ];
        }
        return $configs;
    }
}
