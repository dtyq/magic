<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use PHPUnit\Framework\TestCase;

/**
 * FileTreeUtil 测试类
 * 测试文件树构建工具的各种场景.
 * @internal
 */
class FileTreeUtilTest extends TestCase
{
    /**
     * Test assembleFilesTree with empty input.
     */
    public function testAssembleFilesTreeWithEmptyInput(): void
    {
        $result = FileTreeUtil::assembleFilesTree([]);
        $this->assertEmpty($result);
    }

    /**
     * Test assembleFilesTree with new is_directory field.
     */
    public function testAssembleFilesTreeWithIsDirectoryField(): void
    {
        $files = [
            [
                'file_id' => '1',
                'file_name' => 'src',
                'relative_file_path' => '/src/',
                'is_directory' => true,
                'file_size' => 0,
                'file_extension' => '',
            ],
            [
                'file_id' => '2',
                'file_name' => 'index.php',
                'relative_file_path' => '/src/index.php',
                'is_directory' => false,
                'file_size' => 1024,
                'file_extension' => 'php',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        $this->assertCount(1, $result);
        $this->assertEquals('src', $result[0]['name']);
        $this->assertTrue($result[0]['is_directory']);
        $this->assertEquals('directory', $result[0]['type']);

        $this->assertCount(1, $result[0]['children']);
        $this->assertEquals('index.php', $result[0]['children'][0]['name']);
        $this->assertFalse($result[0]['children'][0]['is_directory']);
        $this->assertEquals('file', $result[0]['children'][0]['type']);
    }

    /**
     * Test assembleFilesTree with legacy data (no is_directory field).
     */
    public function testAssembleFilesTreeWithLegacyData(): void
    {
        $files = [
            [
                'file_id' => '1',
                'file_name' => 'uploads',
                'relative_file_path' => '/uploads/',
                'file_size' => 0,
                'file_extension' => '',
            ],
            [
                'file_id' => '2',
                'file_name' => 'document.pdf',
                'relative_file_path' => '/uploads/document.pdf',
                'file_size' => 2048,
                'file_extension' => 'pdf',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        $this->assertCount(1, $result);
        $this->assertEquals('uploads', $result[0]['name']);
        $this->assertTrue($result[0]['is_directory']);

        $this->assertCount(1, $result[0]['children']);
        $this->assertEquals('document.pdf', $result[0]['children'][0]['name']);
        $this->assertFalse($result[0]['children'][0]['is_directory']);
    }

    /**
     * Test assembleFilesTree with the provided real data.
     */
    public function testAssembleFilesTreeWithProvidedData(): void
    {
        $files = [
            [
                'file_id' => '806248045966565377',
                'task_id' => '0',
                'project_id' => '804396912083546113',
                'file_type' => 'user_upload',
                'file_name' => 'runtime',
                'file_extension' => '',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/runtime/',
                'file_size' => 0,
                'relative_file_path' => '/runtime/',
                'file_url' => 'https://example.com/runtime/',
                'is_hidden' => false,
                'topic_id' => '0',
            ],
            [
                'file_id' => '804398420044881920',
                'task_id' => '804397254884012032',
                'project_id' => '804396912083546113',
                'file_type' => 'system_auto_upload',
                'file_name' => 'index.md',
                'file_extension' => 'md',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/shehu-brand-introduction/index.md',
                'file_size' => 838,
                'relative_file_path' => '/shehu-brand-introduction/index.md',
                'file_url' => 'https://example.com/shehu-brand-introduction/index.md',
                'is_hidden' => false,
                'topic_id' => '804396912272289795',
            ],
            [
                'file_id' => '804398302629535745',
                'task_id' => '804397254884012032',
                'project_id' => '804396912083546113',
                'file_type' => 'system_auto_upload',
                'file_name' => 'shehu-brand-highlights.md',
                'file_extension' => 'md',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/shehu-brand-introduction/shehu-brand-highlights.md',
                'file_size' => 1753,
                'relative_file_path' => '/shehu-brand-introduction/shehu-brand-highlights.md',
                'file_url' => 'https://example.com/shehu-brand-introduction/shehu-brand-highlights.md',
                'is_hidden' => false,
                'topic_id' => '804396912272289795',
            ],
            [
                'file_id' => '804398143174684673',
                'task_id' => '804397254884012032',
                'project_id' => '804396912083546113',
                'file_type' => 'system_auto_upload',
                'file_name' => 'shehu-brand-summary.md',
                'file_extension' => 'md',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/shehu-brand-introduction/shehu-brand-summary.md',
                'file_size' => 1101,
                'relative_file_path' => '/shehu-brand-introduction/shehu-brand-summary.md',
                'file_url' => 'https://example.com/shehu-brand-introduction/shehu-brand-summary.md',
                'is_hidden' => false,
                'topic_id' => '804396912272289795',
            ],
            [
                'file_id' => '804398036583141376',
                'task_id' => '804397254884012032',
                'project_id' => '804396912083546113',
                'file_type' => 'process',
                'file_name' => 'shehu-brand-profile.md',
                'file_extension' => 'md',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/shehu-brand-introduction/shehu-brand-profile.md',
                'file_size' => 3131,
                'relative_file_path' => '/shehu-brand-introduction/shehu-brand-profile.md',
                'file_url' => 'https://example.com/shehu-brand-introduction/shehu-brand-profile.md',
                'is_hidden' => false,
                'topic_id' => '804396912272289795',
            ],
            [
                'file_id' => '804397580504608768',
                'task_id' => '804397254884012032',
                'project_id' => '804396912083546113',
                'file_type' => 'system_auto_upload',
                'file_name' => 'extract_shehu_brand.py',
                'file_extension' => 'py',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/extract_shehu_brand.py',
                'file_size' => 2549,
                'relative_file_path' => '/extract_shehu_brand.py',
                'file_url' => 'https://example.com/extract_shehu_brand.py',
                'is_hidden' => false,
                'topic_id' => '804396912272289795',
            ],
            [
                'file_id' => '804397048436170753',
                'task_id' => '0',
                'project_id' => '804396912083546113',
                'file_type' => 'user_upload',
                'file_name' => '她互与大人糖品牌对比报告(1).xlsx',
                'file_extension' => 'xlsx',
                'file_key' => 'DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_516c3a162c868e6f02de247a10e59d05/project_804396912083546113/uploads/她互与大人糖品牌对比报告(1).xlsx',
                'file_size' => 12677,
                'relative_file_path' => '/uploads/她互与大人糖品牌对比报告(1).xlsx',
                'file_url' => 'https://example.com/uploads/file.xlsx',
                'is_hidden' => false,
                'topic_id' => '804396912272289795',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        // Should have 3 top-level items: runtime, shehu-brand-introduction, extract_shehu_brand.py, uploads
        $this->assertCount(4, $result);

        // Find each top-level item
        $topLevelItems = [];
        foreach ($result as $item) {
            $topLevelItems[$item['name']] = $item;
        }

        // Check runtime directory
        $this->assertArrayHasKey('runtime', $topLevelItems);
        $this->assertTrue($topLevelItems['runtime']['is_directory']);
        $this->assertEquals('directory', $topLevelItems['runtime']['type']);

        // Check shehu-brand-introduction directory
        $this->assertArrayHasKey('shehu-brand-introduction', $topLevelItems);
        $this->assertTrue($topLevelItems['shehu-brand-introduction']['is_directory']);
        $this->assertCount(4, $topLevelItems['shehu-brand-introduction']['children']); // 4 markdown files

        // Check extract_shehu_brand.py file
        $this->assertArrayHasKey('extract_shehu_brand.py', $topLevelItems);
        $this->assertFalse($topLevelItems['extract_shehu_brand.py']['is_directory']);
        $this->assertEquals('file', $topLevelItems['extract_shehu_brand.py']['type']);

        // Check uploads directory
        $this->assertArrayHasKey('uploads', $topLevelItems);
        $this->assertTrue($topLevelItems['uploads']['is_directory']);
        $this->assertCount(1, $topLevelItems['uploads']['children']); // 1 xlsx file
    }

    /**
     * Test assembleFilesTree with hidden files and directories.
     */
    public function testAssembleFilesTreeWithHiddenFiles(): void
    {
        $files = [
            [
                'file_id' => '1',
                'file_name' => '.hidden',
                'relative_file_path' => '/.hidden/',
                'file_size' => 0,
                'file_extension' => '',
            ],
            [
                'file_id' => '2',
                'file_name' => '.config',
                'relative_file_path' => '/.hidden/.config',
                'file_size' => 256,
                'file_extension' => '',
            ],
            [
                'file_id' => '3',
                'file_name' => 'normal.txt',
                'relative_file_path' => '/normal.txt',
                'file_size' => 512,
                'file_extension' => 'txt',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        $this->assertCount(2, $result);

        // Find hidden directory
        $hiddenDir = null;
        $normalFile = null;
        foreach ($result as $item) {
            if ($item['name'] === '.hidden') {
                $hiddenDir = $item;
            } elseif ($item['name'] === 'normal.txt') {
                $normalFile = $item;
            }
        }

        $this->assertNotNull($hiddenDir);
        $this->assertTrue($hiddenDir['is_hidden']);
        $this->assertCount(1, $hiddenDir['children']);
        $this->assertTrue($hiddenDir['children'][0]['is_hidden']); // Child should inherit hidden status

        $this->assertNotNull($normalFile);
        $this->assertFalse($normalFile['is_hidden']);
    }

    /**
     * Test assembleFilesTree with deep nested structure.
     */
    public function testAssembleFilesTreeWithDeepNesting(): void
    {
        $files = [
            [
                'file_id' => '1',
                'file_name' => 'deep.txt',
                'relative_file_path' => '/level1/level2/level3/level4/deep.txt',
                'file_size' => 100,
                'file_extension' => 'txt',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        $this->assertCount(1, $result);

        // Navigate through the nested structure
        $current = $result[0];
        $this->assertEquals('level1', $current['name']);
        $this->assertTrue($current['is_directory']);

        $current = $current['children'][0];
        $this->assertEquals('level2', $current['name']);
        $this->assertTrue($current['is_directory']);

        $current = $current['children'][0];
        $this->assertEquals('level3', $current['name']);
        $this->assertTrue($current['is_directory']);

        $current = $current['children'][0];
        $this->assertEquals('level4', $current['name']);
        $this->assertTrue($current['is_directory']);

        $current = $current['children'][0];
        $this->assertEquals('deep.txt', $current['name']);
        $this->assertFalse($current['is_directory']);
    }

    /**
     * Test assembleFilesTree with mixed file types in same directory.
     */
    public function testAssembleFilesTreeWithMixedFileTypes(): void
    {
        $files = [
            [
                'file_id' => '1',
                'file_name' => 'docs',
                'relative_file_path' => '/project/docs/',
                'is_directory' => true,
                'file_size' => 0,
                'file_extension' => '',
            ],
            [
                'file_id' => '2',
                'file_name' => 'readme.md',
                'relative_file_path' => '/project/readme.md',
                'is_directory' => false,
                'file_size' => 512,
                'file_extension' => 'md',
            ],
            [
                'file_id' => '3',
                'file_name' => 'config.json',
                'relative_file_path' => '/project/config.json',
                'is_directory' => false,
                'file_size' => 256,
                'file_extension' => 'json',
            ],
            [
                'file_id' => '4',
                'file_name' => 'api.md',
                'relative_file_path' => '/project/docs/api.md',
                'is_directory' => false,
                'file_size' => 1024,
                'file_extension' => 'md',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        $this->assertCount(1, $result);
        $project = $result[0];
        $this->assertEquals('project', $project['name']);
        $this->assertTrue($project['is_directory']);
        $this->assertCount(3, $project['children']); // docs/, readme.md, config.json

        // Check that docs directory contains api.md
        $docsDir = null;
        foreach ($project['children'] as $child) {
            if ($child['name'] === 'docs' && $child['is_directory']) {
                $docsDir = $child;
                break;
            }
        }

        $this->assertNotNull($docsDir);
        $this->assertCount(1, $docsDir['children']);
        $this->assertEquals('api.md', $docsDir['children'][0]['name']);
    }

    /**
     * Test assembleFilesTree with files missing relative_file_path.
     */
    public function testAssembleFilesTreeWithMissingRelativePath(): void
    {
        $files = [
            [
                'file_id' => '1',
                'file_name' => 'valid.txt',
                'relative_file_path' => '/valid.txt',
                'file_size' => 100,
                'file_extension' => 'txt',
            ],
            [
                'file_id' => '2',
                'file_name' => 'invalid.txt',
                // missing relative_file_path
                'file_size' => 100,
                'file_extension' => 'txt',
            ],
            [
                'file_id' => '3',
                'file_name' => 'empty_path.txt',
                'relative_file_path' => '', // empty path
                'file_size' => 100,
                'file_extension' => 'txt',
            ],
        ];

        $result = FileTreeUtil::assembleFilesTree($files);

        // Should only include the valid file
        $this->assertCount(1, $result);
        $this->assertEquals('valid.txt', $result[0]['name']);
    }

    /**
     * Test getTreeStats method.
     */
    public function testGetTreeStats(): void
    {
        $tree = [
            [
                'name' => 'src',
                'is_directory' => true,
                'children' => [
                    [
                        'name' => 'app.js',
                        'is_directory' => false,
                        'file_size' => 1024,
                        'children' => [],
                    ],
                    [
                        'name' => 'utils',
                        'is_directory' => true,
                        'children' => [
                            [
                                'name' => 'helper.js',
                                'is_directory' => false,
                                'file_size' => 512,
                                'children' => [],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $stats = FileTreeUtil::getTreeStats($tree);

        $this->assertEquals(2, $stats['directories']); // src, utils
        $this->assertEquals(2, $stats['files']); // app.js, helper.js
        $this->assertEquals(1536, $stats['total_size']); // 1024 + 512
    }

    /**
     * Test flattenTree method.
     */
    public function testFlattenTree(): void
    {
        $tree = [
            [
                'name' => 'src',
                'is_directory' => true,
                'children' => [
                    [
                        'name' => 'app.js',
                        'is_directory' => false,
                        'children' => [],
                    ],
                    [
                        'name' => 'utils',
                        'is_directory' => true,
                        'children' => [
                            [
                                'name' => 'helper.js',
                                'is_directory' => false,
                                'children' => [],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $paths = FileTreeUtil::flattenTree($tree);

        $this->assertCount(2, $paths);
        $this->assertContains('src/app.js', $paths);
        $this->assertContains('src/utils/helper.js', $paths);
    }

    /**
     * Test findNodeByPath method.
     */
    public function testFindNodeByPath(): void
    {
        $tree = [
            [
                'name' => 'src',
                'is_directory' => true,
                'children' => [
                    [
                        'name' => 'app.js',
                        'is_directory' => false,
                        'file_size' => 1024,
                        'children' => [],
                    ],
                ],
            ],
        ];

        // Find existing file
        $node = FileTreeUtil::findNodeByPath($tree, 'src/app.js');
        $this->assertNotNull($node);
        $this->assertEquals('app.js', $node['name']);
        $this->assertEquals(1024, $node['file_size']);

        // Find existing directory
        $node = FileTreeUtil::findNodeByPath($tree, 'src');
        $this->assertNotNull($node);
        $this->assertEquals('src', $node['name']);
        $this->assertTrue($node['is_directory']);

        // Try to find non-existing path
        $node = FileTreeUtil::findNodeByPath($tree, 'nonexistent/path');
        $this->assertNull($node);
    }
}
