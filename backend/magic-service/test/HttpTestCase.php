<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest;

use App\Application\ModelGateway\Official\MagicAccessToken;
use Hyperf\Context\ApplicationContext;
use Hyperf\Testing;
use Mockery;
use PHPUnit\Framework\TestCase;

use function Hyperf\Support\make;

/**
 * Class HttpTestCase.
 * @method get($uri, $data = [], $headers = [])
 * @method post($uri, $data = [], $headers = [])
 * @method delete($uri, $data = [], $headers = [])
 * @method put($uri, $data = [], $headers = [])
 * @method json($uri, $data = [], $headers = [])
 * @method file($uri, $data = [], $headers = [])
 */
abstract class HttpTestCase extends TestCase
{
    /**
     * @var Testing\Client
     */
    protected $client;

    public function __construct(string $name)
    {
        parent::__construct($name);
        $this->client = make(Testing\Client::class);
        // $this->client = make(Testing\HttpClient::class, ['baseUri' => 'http://127.0.0.1:9764']);
        MagicAccessToken::init();
    }

    public function __call($name, $arguments)
    {
        return $this->client->{$name}(...$arguments);
    }

    protected function tearDown(): void
    {
        Mockery::close();
    }

    protected function getCommonHeaders(): array
    {
        return [
            'organization-code' => env('TEST_ORGANIZATION_CODE'),
            // 换成自己的
            'Authorization' => env('TEST_TOKEN'),
        ];
    }

    /**
     * 断言两个数组具有相同的值类型
     * 用于验证数组结构和类型是否匹配.
     *
     * @param array $expected 预期的数组
     * @param array $actual 实际的数组
     * @param string $message 断言失败时的错误消息
     * @param bool $checkKeys 是否检查键值
     */
    protected function assertArrayValueTypesEquals(array $expected, array $actual, string $message = '', bool $checkKeys = true): void
    {
        // 先检查实际数组中是否有所有预期的键
        if ($checkKeys) {
            foreach (array_keys($expected) as $key) {
                $this->assertArrayHasKey($key, $actual, $message . sprintf(' - 键 "%s" 不存在', $key));
            }
        }

        // 递归检查每个值的类型
        foreach ($expected as $key => $expectedValue) {
            // 确保键存在
            if (! array_key_exists($key, $actual)) {
                if ($checkKeys) {
                    $this->fail($message . sprintf(' - 键 "%s" 不存在', $key));
                }
                continue;
            }

            $actualValue = $actual[$key];
            $expectedType = gettype($expectedValue);
            $actualType = gettype($actualValue);

            // 如果预期值为 null，则实际值可以是任意类型
            if ($expectedValue === null) {
                continue;
            }

            // 检查类型匹配
            if ($expectedType !== $actualType && ! ($expectedType === 'double' && $actualType === 'integer')) {
                $this->assertEquals(
                    $expectedType,
                    $actualType,
                    $message . sprintf(' - 键 "%s" 的类型应为 %s，实际为 %s', $key, $expectedType, $actualType)
                );
                continue;
            }

            // 特殊处理字符串类型
            if (is_string($expectedValue) && $expectedValue === 'NOT_EMPTY') {
                $this->assertNotEmpty($actualValue, $message . sprintf(' - 键 "%s" 不应为空字符串', $key));
            }

            // 递归处理数组类型
            if (is_array($expectedValue)) {
                // 如果是空数组，仅检查类型
                if (empty($expectedValue)) {
                    continue;
                }

                // 检查数组是否为索引数组（列表）
                $isIndexedArray = array_keys($expectedValue) === range(0, count($expectedValue) - 1);

                if ($isIndexedArray && ! empty($actualValue)) {
                    // 如果是索引数组，检查第一个元素的类型
                    $firstExpectedItem = reset($expectedValue);
                    $firstActualItem = reset($actualValue);

                    if (is_array($firstExpectedItem)) {
                        $this->assertIsArray($firstActualItem, $message . sprintf(' - 键 "%s" 的数组元素应为数组类型', $key));
                        $this->assertArrayValueTypesEquals(
                            $firstExpectedItem,
                            $firstActualItem,
                            $message . sprintf(' - 键 "%s" 的数组元素', $key),
                            $checkKeys
                        );
                    } else {
                        $expectedItemType = gettype($firstExpectedItem);
                        $actualItemType = gettype($firstActualItem);
                        $this->assertEquals(
                            $expectedItemType,
                            $actualItemType,
                            $message . sprintf(' - 键 "%s" 的数组元素类型应为 %s，实际为 %s', $key, $expectedItemType, $actualItemType)
                        );
                    }
                } elseif (! $isIndexedArray) {
                    // 如果是关联数组，递归验证
                    $this->assertArrayValueTypesEquals(
                        $expectedValue,
                        $actualValue,
                        $message . sprintf(' - 键 "%s" 的子数组', $key),
                        $checkKeys
                    );
                }
            }
        }
    }

    /**
     * 断言两个数组具有相同的值
     * 用于精确验证数组中的具体值是否相等.
     *
     * @param array $expected 预期的数组
     * @param array $actual 实际的数组
     * @param string $message 断言失败时的错误消息
     * @param bool $strict 是否使用严格比较（===）
     * @param bool $checkKeys 是否检查键值
     */
    protected function assertArrayEquals(array $expected, array $actual, string $message = '', bool $strict = true, bool $checkKeys = true): void
    {
        // 先检查实际数组中是否有所有预期的键
        if ($checkKeys) {
            $expectedKeys = array_keys($expected);
            $actualKeys = array_keys($actual);
            $missingKeys = array_diff($expectedKeys, $actualKeys);

            if (! empty($missingKeys)) {
                $this->fail($message . sprintf(' - 缺少键: "%s"', implode('", "', $missingKeys)));
            }
        }

        // 递归检查每个值
        foreach ($expected as $key => $expectedValue) {
            // 确保键存在
            if (! array_key_exists($key, $actual)) {
                if ($checkKeys) {
                    $this->fail($message . sprintf(' - 键 "%s" 不存在', $key));
                }
                continue;
            }

            $actualValue = $actual[$key];

            // 处理数组递归
            if (is_array($expectedValue) && is_array($actualValue)) {
                $this->assertArrayEquals(
                    $expectedValue,
                    $actualValue,
                    $message . sprintf(' - 键 "%s" 的子数组', $key),
                    $strict,
                    $checkKeys
                );
            } else {
                // 对于非数组值，直接比较
                if ($strict) {
                    $this->assertSame(
                        $expectedValue,
                        $actualValue,
                        $message . sprintf(' - 键 "%s" 的值不匹配', $key)
                    );
                } else {
                    $this->assertEquals(
                        $expectedValue,
                        $actualValue,
                        $message . sprintf(' - 键 "%s" 的值不匹配', $key)
                    );
                }
            }
        }
    }

    /**
     * Get the Hyperf DI container instance.
     */
    protected function getContainer()
    {
        return ApplicationContext::getContainer();
    }
}
