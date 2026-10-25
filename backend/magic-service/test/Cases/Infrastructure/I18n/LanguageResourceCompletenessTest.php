<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\I18n;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * 校验后端语言资源与源码中的国际化调用保持一致。
 * @internal
 */
class LanguageResourceCompletenessTest extends TestCase
{
    /**
     * 校验所有语言文件可加载、叶子值非空且中英文占位符一致。
     */
    public function testLanguageFilesAreLoadableAndPlaceholdersAreConsistent(): void
    {
        $resources = $this->loadResources();

        foreach ($resources as $locale => $domains) {
            foreach ($domains as $key => $value) {
                self::assertIsString($value, sprintf('%s.%s 必须是字符串叶子值', $locale, $key));
                self::assertNotSame('', trim($value), sprintf('%s.%s 不能是空字符串', $locale, $key));
            }
        }

        $sharedKeys = array_intersect(array_keys($resources['zh_CN']), array_keys($resources['en_US']));
        foreach ($sharedKeys as $key) {
            self::assertSame(
                $this->extractPlaceholders($resources['zh_CN'][$key]),
                $this->extractPlaceholders($resources['en_US'][$key]),
                sprintf('%s 的中英文占位符必须一致', $key)
            );
        }
    }

    /**
     * 校验不同 locale 的同名资源不会发生标量与数组结构冲突。
     */
    public function testSharedResourceShapesAreConsistent(): void
    {
        $shapes = $this->loadResourceShapes();
        $locales = array_keys($shapes);

        foreach ($locales as $index => $locale) {
            foreach (array_slice($locales, $index + 1) as $otherLocale) {
                foreach (array_intersect_key($shapes[$locale], $shapes[$otherLocale]) as $key => $shape) {
                    self::assertSame(
                        $shape,
                        $shapes[$otherLocale][$key],
                        sprintf('%s 与 %s 的 %s 结构不一致', $locale, $otherLocale, $key)
                    );
                }
            }
        }
    }

    /**
     * 校验源码中明确交给翻译器处理的 key 在 active locale 中均有资源。
     */
    public function testReferencedTranslationKeysExistInActiveLocales(): void
    {
        $resources = $this->loadResources();
        $referencedKeys = $this->extractReferencedKeys();

        foreach (['zh_CN', 'en_US'] as $locale) {
            $missingKeys = array_diff($referencedKeys, array_keys($resources[$locale]));
            self::assertSame([], $missingKeys, sprintf('%s 缺少源码实际使用的国际化资源', $locale));
        }
    }

    /**
     * 读取并展开全部语言文件，统一使用 domain.path 形式比较资源。
     *
     * @return array<string, array<string, string>>
     */
    private function loadResources(): array
    {
        $languageRoot = dirname(__DIR__, 4) . '/storage/languages';
        $resources = [];

        foreach (glob($languageRoot . '/*', GLOB_ONLYDIR) as $localeDirectory) {
            $locale = basename($localeDirectory);
            $resources[$locale] = [];
            foreach (glob($localeDirectory . '/*.php') as $file) {
                $domain = basename($file, '.php');
                $values = require $file;
                self::assertIsArray($values, sprintf('%s 必须返回数组', $file));
                foreach ($this->flatten($values) as $key => $value) {
                    $resources[$locale][$domain . '.' . $key] = $value;
                }
            }
        }

        self::assertArrayHasKey('zh_CN', $resources);
        self::assertArrayHasKey('en_US', $resources);
        return $resources;
    }

    /**
     * 读取全部语言资源的节点类型，用于检测结构冲突。
     *
     * @return array<string, array<string, string>>
     */
    private function loadResourceShapes(): array
    {
        $languageRoot = dirname(__DIR__, 4) . '/storage/languages';
        $shapes = [];

        foreach (glob($languageRoot . '/*', GLOB_ONLYDIR) as $localeDirectory) {
            $locale = basename($localeDirectory);
            $shapes[$locale] = [];
            foreach (glob($localeDirectory . '/*.php') as $file) {
                $domain = basename($file, '.php');
                $values = require $file;
                self::assertIsArray($values, sprintf('%s 必须返回数组', $file));
                foreach ($this->collectShapes($values) as $key => $shape) {
                    $shapes[$locale][$domain . '.' . $key] = $shape;
                }
            }
        }

        return $shapes;
    }

    /**
     * 展开嵌套语言数组。
     *
     * @param array<string, mixed> $values
     * @return array<string, mixed>
     */
    private function flatten(array $values, string $prefix = ''): array
    {
        $result = [];
        foreach ($values as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix . '.' . $key;
            if (is_array($value)) {
                $result += $this->flatten($value, $path);
            } else {
                $result[$path] = $value;
            }
        }
        return $result;
    }

    /**
     * 递归记录节点是数组还是标量。
     *
     * @param array<string, mixed> $values
     * @return array<string, string>
     */
    private function collectShapes(array $values, string $prefix = ''): array
    {
        $result = [];
        foreach ($values as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix . '.' . $key;
            $result[$path] = is_array($value) ? 'array' : 'scalar';
            if (is_array($value)) {
                $result += $this->collectShapes($value, $path);
            }
        }
        return $result;
    }

    /**
     * 从源码中提取明确交给 translator 或 ExceptionBuilder 的静态 key。
     * 动态拼接 key 无法在静态阶段还原，留给运行时或专门的枚举检查处理。
     *
     * @return list<string>
     */
    private function extractReferencedKeys(): array
    {
        $serviceRoot = dirname(__DIR__, 4);
        $roots = [
            $serviceRoot . '/app',
            $serviceRoot . '/config',
            dirname($serviceRoot) . '/api-response',
        ];
        $keys = [];

        foreach ($roots as $root) {
            if (! is_dir($root)) {
                continue;
            }
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
            foreach ($iterator as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $content = file_get_contents($file->getPathname());
                if ($content === false) {
                    continue;
                }

                $this->collectMatches($content, '/\btrans\(\s*[\'\"]([^\'\"]+)/', $keys);
                $this->collectMatches($content, '/\b__\(\s*[\'\"]([^\'\"]+)/', $keys);
                $this->collectMatches($content, '/[\'\"]i18n:([^\'\"]+)[\'\"]/', $keys);
                if (preg_match_all('/ErrorMessage\s*\(\s*(?:message\s*:\s*)?[\'\"]([^\'\"]+)[\'\"]/', $content, $errorMessageMatches) !== false) {
                    foreach ($errorMessageMatches[1] as $key) {
                        if (str_contains($key, '.') || preg_match('/^[a-z0-9_]+$/', $key) === 1) {
                            $keys[] = str_contains($key, '.') ? $key : 'common.' . $key;
                        }
                    }
                }

                $offset = 0;
                while (preg_match('/ExceptionBuilder::throw\s*\(/', $content, $match, PREG_OFFSET_CAPTURE, $offset) === 1) {
                    $start = $match[0][1];
                    $end = strpos($content, ';', $start);
                    $chunk = substr($content, $start, $end === false ? 800 : $end - $start);
                    $this->collectMatches($chunk, '/[\'\"]([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_:-]+)+)[\'\"]/', $keys);
                    $offset = $start + 1;
                }
            }
        }

        $keys = array_filter($keys, static fn (string $key): bool => ! str_contains($key, '{$') && ! str_ends_with($key, '.'));
        $keys = array_values(array_unique($keys));
        sort($keys);
        return $keys;
    }

    /**
     * 收集正则匹配到的国际化 key。
     *
     * @param list<string> $keys
     */
    private function collectMatches(string $content, string $pattern, array &$keys): void
    {
        if (preg_match_all($pattern, $content, $matches) !== false) {
            foreach ($matches[1] as $key) {
                $keys[] = $key;
            }
        }
    }

    /**
     * 提取翻译文案中的命名占位符。
     *
     * @return list<string>
     */
    private function extractPlaceholders(string $value): array
    {
        preg_match_all('/:([A-Za-z_][A-Za-z0-9_]*)/', $value, $matches);
        $placeholders = array_values(array_unique($matches[1]));
        sort($placeholders);
        return $placeholders;
    }
}
