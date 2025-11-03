<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;

class AdapterName
{
    /**
     * 阿里云oss.
     */
    public const ALIYUN = 'aliyun';

    /**
     * 火山云.
     */
    public const TOS = 'tos';

    /**
     * 华为云.
     */
    public const OBS = 'obs';

    /**
     * 文件服务.
     */
    public const FILE_SERVICE = 'file_service';

    /**
     * 本地文件系统.
     */
    public const LOCAL = 'local';

    /**
     * S3/MinIO.
     */
    public const MINIO = 'minio';

    public static function form(string $adapterName): string
    {
        return match (strtolower($adapterName)) {
            'aliyun', 'oss' => self::ALIYUN,
            'tos' => self::TOS,
            'obs' => self::OBS,
            'file_service' => self::FILE_SERVICE,
            'local' => self::LOCAL,
            'minio' => self::MINIO,
            default => throw new CloudFileException("adapter not found | [{$adapterName}]"),
        };
    }

    public static function checkConfig(string $adapterName, array $config): array
    {
        // 检测必填参数
        switch (self::form($adapterName)) {
            case self::ALIYUN:
                if (empty($config['accessId']) || empty($config['accessSecret']) || empty($config['bucket']) || empty($config['endpoint'])) {
                    throw new CloudFileException('config error');
                }
                break;
            case self::OBS:
            case self::TOS:
                if (empty($config['ak']) || empty($config['sk']) || empty($config['bucket']) || empty($config['endpoint']) || empty($config['region'])) {
                    throw new CloudFileException("config error | [{$adapterName}]");
                }
                break;
            case self::FILE_SERVICE:
                if (empty($config['host']) || empty($config['platform']) || empty($config['key'])) {
                    throw new CloudFileException("config error | [{$adapterName}]");
                }
                break;
            case self::MINIO:
                if (empty($config['accessKey']) || empty($config['secretKey']) || empty($config['bucket']) || empty($config['endpoint']) || empty($config['region'])) {
                    throw new CloudFileException("config error | [{$adapterName}]");
                }
                break;
            case self::LOCAL:
                break;
            default:
                throw new CloudFileException("adapter not found | [{$adapterName}]");
        }
        return $config;
    }
}
