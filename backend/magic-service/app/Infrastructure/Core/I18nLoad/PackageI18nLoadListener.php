<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\I18nLoad;

use Hyperf\Contract\TranslatorInterface;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\BootApplication;
use Hyperf\Support\Composer;
use Hyperf\Translation\Translator;
use Psr\Log\LoggerInterface;
use ReflectionClass;

/**
 * 通用包翻译加载监听器.
 *
 * 从 composer 配置中读取所有包声明的 storage-languages 路径，加载各个包的翻译文件。
 *
 * 配置示例（在包的 composer.json 中）：
 * ```json
 * {
 *   "extra": {
 *     "hyperf": {
 *       "config": "Vendor\\Package\\ConfigProvider",
 *       "storage-languages": "storage/languages"
 *     }
 *   }
 * }
 * ```
 */
class PackageI18nLoadListener implements ListenerInterface
{
    protected TranslatorInterface $translator;

    protected LoggerInterface $logger;

    public function __construct(TranslatorInterface $translator, LoggerInterface $logger)
    {
        $this->translator = $translator;
        $this->logger = $logger;
    }

    public function listen(): array
    {
        return [
            BootApplication::class,
        ];
    }

    public function process(object $event): void
    {
        $vendors = Composer::getMergedExtra();

        foreach ($vendors as $vendorName => $extra) {
            $paths = $extra['hyperf']['storage-languages'] ?? [];
            if (empty($paths)) {
                continue;
            }

            // 支持字符串或数组格式
            if (is_string($paths)) {
                $paths = [$paths];
            }

            $prefix = "vendor/{$vendorName}";
            foreach ($paths as $path) {
                if (! str_starts_with($path, $prefix)) {
                    $path = $prefix . '/' . $path;
                }

                $fullPath = BASE_PATH . '/' . $path;
                if (is_dir($fullPath)) {
                    $this->loadPackageTranslations($vendorName, $fullPath);
                    $this->logger->debug('FoundPackageLanguages', [
                        'package' => $vendorName,
                        'path' => $path,
                    ]);
                } else {
                    $this->logger->warning('PackageLanguagesPathNotFound', [
                        'package' => $vendorName,
                        'path' => $fullPath,
                    ]);
                }
            }
        }
    }

    /**
     * 加载包的翻译文件.
     */
    protected function loadPackageTranslations(string $packageName, string $path): void
    {
        if (! is_dir($path)) {
            return;
        }

        /** @var Translator $translator */
        $translator = $this->translator;
        $loader = $translator->getLoader();

        $languages = scandir($path);
        foreach ($languages as $language) {
            if ($language === '.' || $language === '..') {
                continue;
            }

            $langPath = $path . '/' . $language;
            if (is_dir($langPath)) {
                $files = scandir($langPath);

                foreach ($files as $file) {
                    if (pathinfo($file, PATHINFO_EXTENSION) === 'php') {
                        $group = pathinfo($file, PATHINFO_FILENAME);
                        $filePath = $langPath . '/' . $file;
                        $packageTranslations = require $filePath;

                        if ($packageTranslations && is_array($packageTranslations)) {
                            // 从主项目加载标准翻译文件（如果存在）
                            $standardTranslations = $loader->load($language, $group, '*');

                            // 使用反射强制设置 loaded 数组，确保包含标准翻译和包翻译
                            $reflection = new ReflectionClass($translator);
                            $loadedProperty = $reflection->getProperty('loaded');
                            $loaded = $loadedProperty->getValue($translator);

                            // 合并标准翻译和包翻译（包翻译会覆盖同名的标准翻译）
                            $mergedTranslations = array_merge($standardTranslations, $packageTranslations);

                            // 如果已经有其他包的翻译，继续合并
                            if (isset($loaded['*'][$group][$language])) {
                                $mergedTranslations = array_merge($loaded['*'][$group][$language], $mergedTranslations);
                            }

                            $loaded['*'][$group][$language] = $mergedTranslations;

                            $loadedProperty->setValue($translator, $loaded);

                            $this->logger->debug('LoadedPackageTranslations', [
                                'package' => $packageName,
                                'language' => $language,
                                'group' => $group,
                                'count' => count($packageTranslations),
                            ]);
                        }
                    }
                }
            }
        }
    }
}
