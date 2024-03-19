<?php

/** @noinspection ALL */

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Carbon\Carbon;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

if (! function_exists('make')) {
    function make(string $abstract, array $parameters = []): object
    {
        return \Hyperf\Support\make($abstract, $parameters);
    }
}

if (! function_exists('container')) {
    function container(): ContainerInterface
    {
        return ApplicationContext::getContainer();
    }
}

if (! function_exists('di')) {
    function di(?string $id = null): mixed
    {
        $container = ApplicationContext::getContainer();
        if ($id) {
            return $container->get($id);
        }
        return $container;
    }
}

if (! function_exists('env')) {
    function env(string $key, $default = null): mixed
    {
        return \Hyperf\Support\env($key, $default);
    }
}

if (! function_exists('config')) {
    function config(string $key, mixed $default = null): mixed
    {
        return \Hyperf\Config\config($key, $default);
    }
}

if (! function_exists('app_env')) {
    function app_env(): string
    {
        return ApplicationContext::getContainer()->get(ConfigInterface::class)->get('app_env');
    }
}

if (! function_exists('app_name')) {
    function app_name(): string
    {
        return ApplicationContext::getContainer()->get(ConfigInterface::class)->get('app_name');
    }
}

if (! function_exists('is_unit_test')) {
    function is_unit_test(): bool
    {
        if (defined('UNIT_TEST') && UNIT_TEST === true) {
            return true;
        }
        return false;
    }
}

if (! function_exists('camelize')) {
    /**
     * 下划线转驼峰.
     * @param string $unCamelizeWords 需要转换的字符串
     * @param string $separator 分隔符
     */
    function camelize(string $unCamelizeWords, string $separator = '_'): string
    {
        if (empty($unCamelizeWords)) {
            return '';
        }
        if (! str_contains($unCamelizeWords, $separator)) {
            // 认为已经是小驼峰
            return $unCamelizeWords;
        }
        $unCamelizeWords = $separator . str_replace($separator, ' ', strtolower($unCamelizeWords));
        return ltrim(str_replace(' ', '', ucwords($unCamelizeWords)), $separator);
    }
}

if (! function_exists('un_camelize')) {
    /**
     * 驼峰命名转下划线命名.
     * @param string $camelCaps 需要转换的字符串
     * @param string $separator 分隔符
     */
    function un_camelize(string $camelCaps, string $separator = '_'): string
    {
        if (empty($camelCaps)) {
            return '';
        }
        return strtolower(preg_replace('/([a-z])([A-Z])/', '$1' . $separator . '$2', $camelCaps));
    }
}

if (! function_exists('string_to_hump')) {
    /**
     * 下划线转成驼峰命名,默认小驼峰.
     * @param string $string 要转换的字符串
     * @param bool $firstUp 是否首字母大写,默认否
     */
    function string_to_hump(string $string, bool $firstUp = false): string
    {
        $humpString = camelize($string);
        return $firstUp ? $humpString : lcfirst($humpString);
    }
}

if (! function_exists('string_to_line')) {
    /**
     * 驼峰命名转下划线
     * @param string $string 要转换的字符串
     */
    function string_to_line(string $string, string $separator = '_'): string
    {
        return un_camelize($string, $separator);
    }
}

if (! function_exists('array_key_to_line')) {
    /**
     * 转换数组key成下划线
     * @param array $array 要转换的数组
     */
    function array_key_to_line(array $array): array
    {
        $convert = [];
        foreach ($array as $key => $value) {
            if (is_array($value)) {
                $convert[is_string($key) ? string_to_line($key) : $key] = array_key_to_line($value);
            } else {
                $convert[is_string($key) ? string_to_line($key) : $key] = $value;
            }
        }

        return $convert;
    }
}

if (! function_exists('array_key_to_hump')) {
    /**
     * 转换数组key成驼峰.
     * @param array $array 要转换的数组
     */
    function array_key_to_hump(array $array, bool $firstUp = false, bool $loop = true): array
    {
        $convert = [];
        foreach ($array as $key => $value) {
            if (is_array($value) && $loop) {
                $convert[is_string($key) ? string_to_hump($key, $firstUp) : $key] = array_key_to_hump($value, $firstUp);
            } else {
                $convert[is_string($key) ? string_to_hump($key, $firstUp) : $key] = $value;
            }
        }

        return $convert;
    }
}

if (! function_exists('format_micro_time')) {
    function format_micro_time(float|string $microTime): string
    {
        if (is_string($microTime)) {
            $microTimes = explode(' ', $microTime);
            $integerTimestamp = (int) $microTimes[1];
            $microseconds = (int) $microTimes[0] * 1000000;
        } else {
            $integerTimestamp = (int) $microTime;
            $microseconds = ($microTime - $integerTimestamp) * 1000000; // 微秒部分
        }
        $dateTime = date('Y-m-d H:i:s', $integerTimestamp);
        return "{$dateTime}.{$microseconds}";
    }
}

if (! function_exists('flatten_array')) {
    function flatten_array(array $array, string $prefix = ''): array
    {
        $result = [];
        foreach ($array as $key => $value) {
            $newKey = ($prefix ? $prefix . '.' : '') . $key;
            if (is_array($value)) {
                $result = array_merge($result, flatten_array($value, $newKey));
            } else {
                $result[$newKey] = $value;
            }
        }
        return $result;
    }
}

if (! function_exists('un_flatten_array')) {
    function un_flatten_array(array $array): array
    {
        $result = [];
        foreach ($array as $key => $value) {
            $keys = explode('.', (string) $key);
            $ref = &$result;
            foreach ($keys as $subKey) {
                $ref = &$ref[$subKey];
            }
            $ref = $value;
        }
        return $result;
    }
}

if (! function_exists('simple_logger')) {
    function simple_logger(string $name = 'simple_logger'): LoggerInterface
    {
        return ApplicationContext::getContainer()->get(LoggerFactory::class)->get($name);
    }
}

if (! function_exists('simple_log')) {
    function simple_log(string $message, array $context = []): void
    {
        simple_logger()->info($message, $context);
    }
}

if (! function_exists('calculate_elapsed_time')) {
    function calculate_elapsed_time(float $requestTime, float $responseTime): float
    {
        return round(($responseTime - $requestTime) * 1000, 2);
    }
}

if (! function_exists('diff_day')) {
    /**
     * 从开始时间到现在是第几天.
     */
    function diff_day(DateTime $startTime): int
    {
        return (int) Carbon::make($startTime->format('Y-m-d'))->diffInDays(Carbon::today()) + 1;
    }
}

if (! function_exists('swoole_get_local_mac')) {
    /**
     * 用于平替Swoole函数.
     */
    function swoole_get_local_mac(): array
    {
        static $macs;
        if (isset($macs)) {
            return $macs;
        }
        $macs = [];
        if (PHP_OS_FAMILY === 'Linux') {
            $devices = glob('/sys/class/net/*');
            foreach ($devices as $device) {
                $mac = @file_get_contents($device . '/address');
                if (is_string($mac)) {
                    $macs[basename($device)] = trim($mac);
                }
            }
        } elseif (PHP_OS_FAMILY === 'Darwin') { // Mac OS
            $ifconfig = shell_exec('ifconfig');
            if (is_string($ifconfig)) {
                preg_match_all('/^(\w+):[\s\S]+?\tether (\w\w:\w\w:\w\w:\w\w:\w\w:\w\w)/m', $ifconfig, $matches, PREG_SET_ORDER);
                foreach ($matches as $match) {
                    $macs[$match[1]] = $match[2];
                }
            }
        } else {
            throw new RuntimeException('Unsupported OS');
        }
        return $macs;
    }
}

if (! function_exists('create_empty_iterable')) {
    function create_empty_iterable(): iterable
    {
        yield from [];
    }
}

if (! function_exists('list_to_tree')) {
    function list_to_tree(array $array, string $root = '0', string $id = 'id', string $pid = 'pid', string $child = 'child'): array
    {
        $tree = [];
        foreach ($array as $k => $v) {
            if ($v[$pid] == $root) {
                $v[$child] = list_to_tree($array, $v[$id], $id, $pid, $child);
                $tree[] = $v;
                unset($array[$k]);
            }
        }
        return $tree;
    }
}

if (! function_exists('tree_to_list')) {
    function tree_to_list(array $tree, string $id = 'id', string $child = 'child'): array
    {
        $array = [];
        foreach ($tree as $k => $val) {
            $array[] = $val;
            if (! empty($val[$child])) {
                $children = tree_to_list($val[$child], $id);
                if ($children) {
                    $array = array_merge($array, $children);
                }
            }
        }
        foreach ($array as &$item) {
            unset($item[$child]);
        }
        return $array;
    }
}

if (! function_exists('create_datetime')) {
    function create_datetime(array|int|string $time = 'now', ?DateTimeZone $timezone = null): DateTime
    {
        if (is_array($time)) {
            $time = $time['date'] ?? 'now';
            $timezone = $time['timezone'] ?? null;
        }
        if (is_integer($time)) {
            $time = date('Y-m-d H:i:s', $time);
        }
        return new DateTime($time, $timezone);
    }
}

if (! function_exists('is_url')) {
    function is_url(string $url): bool
    {
        /*
         * This pattern is derived from Symfony\Component\Validator\Constraints\UrlValidator (2.7.4).
         *
         * (c) Fabien Potencier <fabien@symfony.com> http://symfony.com
         *
         * Modified to support URLs with spaces by automatically encoding them.
         */
        $pattern = '~^
            ((aaa|aaas|about|acap|acct|acr|adiumxtra|afp|afs|aim|apt|attachment|aw|barion|beshare|bitcoin|blob|bolo|callto|cap|chrome|chrome-extension|cid|coap|coaps|com-eventbrite-attendee|content|crid|cvs|data|dav|dict|dlna-playcontainer|dlna-playsingle|dns|dntp|dtn|dvb|ed2k|example|facetime|fax|feed|feedready|file|filesystem|finger|fish|ftp|geo|gg|git|gizmoproject|go|gopher|gtalk|h323|ham|hcp|http|https|iax|icap|icon|im|imap|info|iotdisco|ipn|ipp|ipps|irc|irc6|ircs|iris|iris.beep|iris.lwz|iris.xpc|iris.xpcs|itms|jabber|jar|jms|keyparc|lastfm|ldap|ldaps|magnet|mailserver|mailto|maps|market|message|mid|mms|modem|ms-help|ms-settings|ms-settings-airplanemode|ms-settings-bluetooth|ms-settings-camera|ms-settings-cellular|ms-settings-cloudstorage|ms-settings-emailandaccounts|ms-settings-language|ms-settings-location|ms-settings-lock|ms-settings-nfctransactions|ms-settings-notifications|ms-settings-power|ms-settings-privacy|ms-settings-proximity|ms-settings-screenrotation|ms-settings-wifi|ms-settings-workplace|msnim|msrp|msrps|mtqp|mumble|mupdate|mvn|news|nfs|ni|nih|nntp|notes|oid|opaquelocktoken|pack|palm|paparazzi|pkcs11|platform|pop|pres|prospero|proxy|psyc|query|redis|rediss|reload|res|resource|rmi|rsync|rtmfp|rtmp|rtsp|rtsps|rtspu|secondlife|s3|service|session|sftp|sgn|shttp|sieve|sip|sips|skype|smb|sms|smtp|snews|snmp|soap.beep|soap.beeps|soldat|spotify|ssh|steam|stun|stuns|submit|svn|tag|teamspeak|tel|teliaeid|telnet|tftp|things|thismessage|tip|tn3270|turn|turns|tv|udp|unreal|urn|ut2004|vemmi|ventrilo|videotex|view-source|wais|webcal|ws|wss|wtai|wyciwyg|xcon|xcon-userid|xfire|xmlrpc\.beep|xmlrpc.beeps|xmpp|xri|ymsgr|z39\.50|z39\.50r|z39\.50s))://                                 # protocol
            (([\pL\pN-]+:)?([\pL\pN-]+)@)?          # basic auth
            (
                ([\pL\pN\pS\-\.])+(\.?([\pL]|xn\-\-[\pL\pN-]+)+\.?) # a domain name
                    |                                              # or
                \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}                 # an IP address
                    |                                              # or
                \[
                    (?:(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){6})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:::(?:(?:(?:[0-9a-f]{1,4})):){5})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:[0-9a-f]{1,4})))?::(?:(?:(?:[0-9a-f]{1,4})):){4})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,1}(?:(?:[0-9a-f]{1,4})))?::(?:(?:(?:[0-9a-f]{1,4})):){3})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,2}(?:(?:[0-9a-f]{1,4})))?::(?:(?:(?:[0-9a-f]{1,4})):){2})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,3}(?:(?:[0-9a-f]{1,4})))?::(?:(?:[0-9a-f]{1,4})):)(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,4}(?:(?:[0-9a-f]{1,4})))?::)(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,5}(?:(?:[0-9a-f]{1,4})))?::)(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,6}(?:(?:[0-9a-f]{1,4})))?::))))
                \]  # an IPv6 address
            )
            (:[0-9]+)?                              # a port (optional)
            (/?|/\S+|\?\S*|\#\S*)                   # a /, nothing, a / with something, a query or a fragment
        $~ixu';

        // First try to validate the URL as-is
        if (preg_match($pattern, $url) > 0) {
            return true;
        }

        // If validation fails and URL contains spaces, try again with encoded spaces
        if (strpos($url, ' ') !== false) {
            $encodedUrl = str_replace(' ', '%20', $url);
            return preg_match($pattern, $encodedUrl) > 0;
        }

        return false;
    }
}

if (! function_exists('event_dispatch')) {
    function event_dispatch(object $event): void
    {
        make(EventDispatcherInterface::class)->dispatch($event);
    }
}

if (! function_exists('get_path_by_url')) {
    function get_path_by_url(string $url): string
    {
        if (! is_url($url)) {
            return '';
        }
        $parsedUrl = parse_url($url);
        $path = $parsedUrl['path'] ?? '';
        return trim($path, '/');
    }
}

if (! function_exists('parse_json_config')) {
    // 解析JSON配置或返回空数组
    function parse_json_config(null|array|string $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if ($value === null || $value === '') {
            return [];
        }
        $parsed = json_decode($value, true);
        return (json_last_error() === JSON_ERROR_NONE) ? $parsed : [];
    }
}
