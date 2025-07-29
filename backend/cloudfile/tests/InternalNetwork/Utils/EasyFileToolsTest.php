<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\InternalNetwork\Utils;

use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use PHPUnit\Framework\TestCase;

/**
 * Internal Network Endpoint Conversion Tests.
 *
 * These tests verify the functionality of EasyFileTools for converting
 * public cloud storage endpoints to their internal network equivalents.
 * @internal
 * @coversNothing
 */
class EasyFileToolsTest extends TestCase
{
    /**
     * Test OSS endpoint conversion to internal network.
     */
    public function testConvertOSSToInternalEndpoint(): void
    {
        // Test standard OSS endpoints
        $testCases = [
            'https://oss-cn-hangzhou.aliyuncs.com' => 'https://oss-cn-hangzhou-internal.aliyuncs.com',
            'https://oss-cn-beijing.aliyuncs.com' => 'https://oss-cn-beijing-internal.aliyuncs.com',
            'https://oss-cn-shenzhen.aliyuncs.com' => 'https://oss-cn-shenzhen-internal.aliyuncs.com',
            'oss-us-west-1.aliyuncs.com' => 'https://oss-us-west-1-internal.aliyuncs.com',
        ];

        foreach ($testCases as $input => $expected) {
            $result = EasyFileTools::convertOSSToInternalEndpoint($input);
            $this->assertEquals($expected, $result, "Failed to convert: {$input}");
        }
    }

    /**
     * Test TOS endpoint conversion to internal network.
     */
    public function testConvertTOSToInternalEndpoint(): void
    {
        // Test standard TOS endpoints
        $testCases = [
            'https://tos-cn-beijing.volces.com' => 'https://tos-cn-beijing.ivolces.com',
            'https://tos-cn-guangzhou.volces.com' => 'https://tos-cn-guangzhou.ivolces.com',
            'https://tos-s3-cn-beijing.volces.com' => 'https://tos-s3-cn-beijing.ivolces.com',
            'tos-ap-singapore-1.volces.com' => 'https://tos-ap-singapore-1.ivolces.com',
        ];

        foreach ($testCases as $input => $expected) {
            $result = EasyFileTools::convertTOSToInternalEndpoint($input);
            $this->assertEquals($expected, $result, "Failed to convert: {$input}");
        }
    }

    /**
     * Test generic internal endpoint conversion.
     */
    public function testConvertToInternalEndpoint(): void
    {
        // Test OSS conversion via generic method
        $ossResult1 = EasyFileTools::convertToInternalEndpoint('https://oss-cn-hangzhou.aliyuncs.com', 'aliyun', true);
        $this->assertEquals('https://oss-cn-hangzhou-internal.aliyuncs.com', $ossResult1);

        $ossResult2 = EasyFileTools::convertToInternalEndpoint('https://oss-cn-hangzhou.aliyuncs.com', 'aliyun', false);
        $this->assertEquals('https://oss-cn-hangzhou.aliyuncs.com', $ossResult2);

        // Test TOS conversion via generic method
        $tosResult1 = EasyFileTools::convertToInternalEndpoint('https://tos-cn-beijing.volces.com', 'tos', true);
        $this->assertEquals('https://tos-cn-beijing.ivolces.com', $tosResult1);

        $tosResult2 = EasyFileTools::convertToInternalEndpoint('https://tos-cn-beijing.volces.com', 'tos', false);
        $this->assertEquals('https://tos-cn-beijing.volces.com', $tosResult2);
    }

    /**
     * Test edge cases and error conditions.
     */
    public function testEdgeCases(): void
    {
        // Test empty string - should return empty string (no valid endpoint to convert)
        $result = EasyFileTools::convertOSSToInternalEndpoint('');
        $this->assertEquals('', $result);

        // Test empty string for TOS
        $result = EasyFileTools::convertTOSToInternalEndpoint('');
        $this->assertEquals('', $result);

        // Test malformed URLs
        $malformed = 'not-a-valid-url';
        $result = EasyFileTools::convertToInternalEndpoint($malformed, 'aliyun', true);
        $this->assertEquals($malformed, $result);

        // Test endpoints that don't match expected patterns
        $customEndpoint = 'https://custom-oss-endpoint.example.com';
        $result = EasyFileTools::convertOSSToInternalEndpoint($customEndpoint);
        $this->assertEquals($customEndpoint, $result);
    }
}
