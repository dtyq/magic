<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Listener;

use Hyperf\Contract\TranslatorInterface;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\BootApplication;
use Hyperf\Translation\Translator;

class I18nLoadListener implements ListenerInterface
{
    protected TranslatorInterface $translator;

    public function __construct(TranslatorInterface $translator)
    {
        $this->translator = $translator;
    }

    public function listen(): array
    {
        return [
            BootApplication::class,
        ];
    }

    public function process(object $event): void
    {
        // super-magic-module i18n文件路径
        $i18nPath = BASE_PATH . '/vendor/dtyq/super-magic-module/storage/languages';
        $this->loadTranslations($i18nPath);
    }

    private function loadTranslations(string $path): void
    {
        if (! is_dir($path)) {
            return;
        }

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
                        $translations = require $filePath;

                        // 如果需要，手动添加翻译行
                        if ($translations && is_array($translations)) {
                            $lines = [];
                            foreach ($translations as $key => $value) {
                                $lines["{$group}.{$key}"] = $value;
                            }

                            /** @var Translator $translator */
                            $translator = $this->translator;
                            $translator->addLines($lines, $language);
                        }
                    }
                }
            }
        }
    }
}
