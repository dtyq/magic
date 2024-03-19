<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Infrastructure\Utils\FileNameSorter;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for FileNameSorter.
 *
 * Tests VS Code-style file sorting:
 * 1. Directories before files
 * 2. Natural number sorting (file2 < file10)
 * 3. Case-insensitive comparison
 * 4. Chinese pinyin sorting (zh_CN locale)
 * @internal
 */
class FileNameSorterTest extends TestCase
{
    /**
     * @dataProvider sortingDataProvider
     */
    public function testSorting(array $input, array $expected, string $locale): void
    {
        $sorter = new FileNameSorter($locale);
        $sorter->sort($input);

        // Extract names, supporting both 'name' and 'file_name' fields
        $names = array_map(function ($item) {
            return $item['name'] ?? $item['file_name'] ?? '';
        }, $input);
        $this->assertEquals($expected, $names);
    }

    public function sortingDataProvider(): array
    {
        return [
            // Case 1: Directories before files
            'directories_first' => [
                'input' => [
                    ['name' => 'file.txt', 'is_directory' => false],
                    ['name' => 'src', 'is_directory' => true],
                ],
                'expected' => ['src', 'file.txt'],
                'locale' => 'en_US',
            ],

            // Case 2: Natural number sorting
            'natural_number_sort' => [
                'input' => [
                    ['name' => 'file10.txt', 'is_directory' => false],
                    ['name' => 'file2.txt', 'is_directory' => false],
                    ['name' => 'file1.txt', 'is_directory' => false],
                ],
                'expected' => ['file1.txt', 'file2.txt', 'file10.txt'],
                'locale' => 'en_US',
            ],

            // Case 3: Case insensitive sorting
            'case_insensitive' => [
                'input' => [
                    ['name' => 'Zebra.txt', 'is_directory' => false],
                    ['name' => 'apple.txt', 'is_directory' => false],
                    ['name' => 'BANANA.txt', 'is_directory' => false],
                ],
                'expected' => ['apple.txt', 'BANANA.txt', 'Zebra.txt'],
                'locale' => 'en_US',
            ],

            // Case 4: Chinese pinyin sorting
            'chinese_pinyin_sort' => [
                'input' => [
                    ['name' => '中国.md', 'is_directory' => false],
                    ['name' => '北京.md', 'is_directory' => false],
                    ['name' => '上海.md', 'is_directory' => false],
                ],
                'expected' => ['北京.md', '上海.md', '中国.md'], // b < s < z
                'locale' => 'zh_CN',
            ],

            // Case 5: Hidden files (dot prefix)
            'hidden_files' => [
                'input' => [
                    ['name' => 'src', 'is_directory' => true],
                    ['name' => '.git', 'is_directory' => true],
                    ['name' => 'README.md', 'is_directory' => false],
                    ['name' => '.gitignore', 'is_directory' => false],
                ],
                'expected' => ['.git', 'src', '.gitignore', 'README.md'],
                'locale' => 'en_US',
            ],

            // Case 6: Mixed scenario
            'mixed_scenario' => [
                'input' => [
                    ['name' => 'file2.txt', 'is_directory' => false],
                    ['name' => 'src', 'is_directory' => true],
                    ['name' => '.env', 'is_directory' => false],
                    ['name' => 'file10.txt', 'is_directory' => false],
                    ['name' => '.vscode', 'is_directory' => true],
                    ['name' => 'README.md', 'is_directory' => false],
                ],
                'expected' => [
                    '.vscode', 'src',           // Directories (alphabetical)
                    '.env', 'file2.txt', 'file10.txt', 'README.md',  // Files
                ],
                'locale' => 'en_US',
            ],

            // Case 7: Multiple directories sorting
            'multiple_directories' => [
                'input' => [
                    ['name' => 'utils', 'is_directory' => true],
                    ['name' => 'components', 'is_directory' => true],
                    ['name' => 'App.tsx', 'is_directory' => false],
                    ['name' => 'assets', 'is_directory' => true],
                ],
                'expected' => ['assets', 'components', 'utils', 'App.tsx'],
                'locale' => 'en_US',
            ],

            // Case 8: Using file_name field instead of name
            'file_name_field' => [
                'input' => [
                    ['file_name' => 'b.txt', 'is_directory' => false],
                    ['file_name' => 'a.txt', 'is_directory' => false],
                ],
                'expected' => ['a.txt', 'b.txt'],
                'locale' => 'en_US',
            ],
        ];
    }

    public function testSortTree(): void
    {
        $tree = [
            [
                'name' => 'z-folder',
                'is_directory' => true,
                'children' => [
                    ['name' => 'c.txt', 'is_directory' => false, 'children' => []],
                    ['name' => 'a.txt', 'is_directory' => false, 'children' => []],
                    ['name' => 'b.txt', 'is_directory' => false, 'children' => []],
                ],
            ],
            [
                'name' => 'a-folder',
                'is_directory' => true,
                'children' => [],
            ],
            [
                'name' => 'file.txt',
                'is_directory' => false,
                'children' => [],
            ],
        ];

        $sorter = new FileNameSorter('en_US');
        $sorter->sortTree($tree);

        // Check root level sorting: directories first, then alphabetical
        $this->assertEquals('a-folder', $tree[0]['name']);
        $this->assertEquals('z-folder', $tree[1]['name']);
        $this->assertEquals('file.txt', $tree[2]['name']);

        // Check children sorting
        $this->assertEquals('a.txt', $tree[1]['children'][0]['name']);
        $this->assertEquals('b.txt', $tree[1]['children'][1]['name']);
        $this->assertEquals('c.txt', $tree[1]['children'][2]['name']);
    }

    public function testLocaleNormalization(): void
    {
        // Test various locale formats
        $sorter1 = new FileNameSorter('zh');
        $sorter2 = new FileNameSorter('zh_CN');
        $sorter3 = new FileNameSorter('zh-CN');
        $sorter4 = new FileNameSorter(null);
        $sorter5 = new FileNameSorter('');

        // All should work without throwing exceptions
        $this->assertInstanceOf(FileNameSorter::class, $sorter1);
        $this->assertInstanceOf(FileNameSorter::class, $sorter2);
        $this->assertInstanceOf(FileNameSorter::class, $sorter3);
        $this->assertInstanceOf(FileNameSorter::class, $sorter4);
        $this->assertInstanceOf(FileNameSorter::class, $sorter5);
    }

    public function testGetComparator(): void
    {
        $sorter = new FileNameSorter('en_US');
        $comparator = $sorter->getComparator();

        $this->assertIsCallable($comparator);

        // Test comparator directly
        $result = $comparator(
            ['name' => 'b.txt', 'is_directory' => false],
            ['name' => 'a.txt', 'is_directory' => false]
        );

        $this->assertGreaterThan(0, $result); // b > a
    }

    public function testCompareDirectories(): void
    {
        $sorter = new FileNameSorter('en_US');

        // Directory should come before file
        $result = $sorter->compare(
            ['name' => 'z-folder', 'is_directory' => true],
            ['name' => 'a-file.txt', 'is_directory' => false]
        );
        $this->assertLessThan(0, $result);

        // File should come after directory
        $result = $sorter->compare(
            ['name' => 'a-file.txt', 'is_directory' => false],
            ['name' => 'z-folder', 'is_directory' => true]
        );
        $this->assertGreaterThan(0, $result);
    }

    public function testNaturalNumberSortingEdgeCases(): void
    {
        $sorter = new FileNameSorter('en_US');

        $input = [
            ['name' => 'file100.txt', 'is_directory' => false],
            ['name' => 'file20.txt', 'is_directory' => false],
            ['name' => 'file3.txt', 'is_directory' => false],
            ['name' => 'file1.txt', 'is_directory' => false],
        ];

        $sorter->sort($input);
        $names = array_column($input, 'name');

        $this->assertEquals(['file1.txt', 'file3.txt', 'file20.txt', 'file100.txt'], $names);
    }

    public function testEmptyArraySorting(): void
    {
        $sorter = new FileNameSorter('en_US');

        $input = [];
        $sorter->sort($input);

        $this->assertEmpty($input);
    }

    public function testSingleItemSorting(): void
    {
        $sorter = new FileNameSorter('en_US');

        $input = [['name' => 'single.txt', 'is_directory' => false]];
        $sorter->sort($input);

        $this->assertCount(1, $input);
        $this->assertEquals('single.txt', $input[0]['name']);
    }

    /**
     * Test sorting with special characters in file names.
     */
    public function testSpecialCharactersSorting(): void
    {
        $sorter = new FileNameSorter('en_US');

        $input = [
            ['name' => '_underscore.txt', 'is_directory' => false],
            ['name' => '#hash.txt', 'is_directory' => false],
            ['name' => '@at.txt', 'is_directory' => false],
            ['name' => 'normal.txt', 'is_directory' => false],
        ];

        $sorter->sort($input);

        // Just verify no exceptions are thrown and array is sorted
        $this->assertCount(4, $input);
    }
}
