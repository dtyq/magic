<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Design\Service;

use App\Application\SuperMagic\Design\Service\HtmlDesignStyleSourceService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class HtmlDesignStyleSourceServiceTest extends TestCase
{
    private string $tempRoot = '';

    protected function setUp(): void
    {
        parent::setUp();

        $this->tempRoot = sys_get_temp_dir() . '/html_design_style_' . uniqid();
        mkdir($this->tempRoot . '/apple', 0777, true);
        mkdir($this->tempRoot . '/nested', 0777, true);
        file_put_contents($this->tempRoot . '/apple/DESIGN.md', "---\nname: Apple\n---\n# Apple\n", LOCK_EX);
    }

    protected function tearDown(): void
    {
        if ($this->tempRoot !== '') {
            foreach (glob($this->tempRoot . '/*/*', GLOB_MARK) as $file) {
                @unlink($file);
            }
            @rmdir($this->tempRoot . '/apple');
            @rmdir($this->tempRoot . '/nested');
            @rmdir($this->tempRoot);
        }

        parent::tearDown();
    }

    public function testReadsKnownStyleSource(): void
    {
        $result = $this->service()->getSource('apple');

        $this->assertSame('apple', $result['style_code']);
        $this->assertStringContainsString('# Apple', $result['content']);
        $this->assertSame(hash('sha256', $result['content']), $result['sha256']);
    }

    public function testRejectsInvalidStyleCode(): void
    {
        $this->assertThrowsErrorCode(DesignErrorCode::InvalidStyleCode, function (): void {
            $this->service()->getSource('../../etc/passwd');
        });
    }

    public function testRejectsEmptyStyleCode(): void
    {
        $this->assertThrowsErrorCode(DesignErrorCode::InvalidStyleCode, function (): void {
            $this->service()->getSource('  ');
        });
    }

    public function testUnknownStyleThrowsNotFound(): void
    {
        $this->assertThrowsErrorCode(DesignErrorCode::StyleSourceNotFound, function (): void {
            $this->service()->getSource('does-not-exist');
        });
    }

    public function testRejectsAbsolutePathStyleCode(): void
    {
        $this->assertThrowsErrorCode(DesignErrorCode::InvalidStyleCode, function (): void {
            $this->service()->getSource('/etc/passwd');
        });
    }

    public function testRejectsBackslashStyleCode(): void
    {
        $this->assertThrowsErrorCode(DesignErrorCode::InvalidStyleCode, function (): void {
            $this->service()->getSource('apple\..\nested');
        });
    }

    private function service(): HtmlDesignStyleSourceService
    {
        return new HtmlDesignStyleSourceService($this->tempRoot);
    }

    private function assertThrowsErrorCode(DesignErrorCode $expected, callable $callback): void
    {
        try {
            $callback();
        } catch (BusinessException $exception) {
            $this->assertSame($expected->value, $exception->getCode(), $exception->getMessage());
            return;
        }

        $this->fail('Expected error code ' . $expected->name . ' but no exception was thrown');
    }
}
