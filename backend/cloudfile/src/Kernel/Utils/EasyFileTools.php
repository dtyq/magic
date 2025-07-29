<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

class EasyFileTools
{
    public static function isImage(string $path): bool
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        return in_array($ext, ['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp', 'tiff']);
    }

    public static function isUrl(string $url): bool
    {
        /*
         * This pattern is derived from Symfony\Component\Validator\Constraints\UrlValidator (2.7.4).
         *
         * (c) Fabien Potencier <fabien@symfony.com> http://symfony.com
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

        return preg_match($pattern, $url) > 0;
    }

    public static function isBase64Image(string $str): bool
    {
        $data = explode(',', $str);
        if (count($data) !== 2) {
            return false;
        }
        $header = $data[0];
        if (! preg_match('/^data:image\/(png|jpg|jpeg|gif|bmp|webp);base64$/', $header)) {
            return false;
        }
        $encodedImage = $data[1];
        $decodedImage = base64_decode($encodedImage, true);
        return $decodedImage !== false;
    }

    /**
     * Convert OSS endpoint to internal network endpoint for STS operations.
     *
     * @param string $endpoint Public endpoint (e.g., https://oss-cn-hangzhou.aliyuncs.com)
     * @return string Internal endpoint (e.g., https://oss-cn-hangzhou-internal.aliyuncs.com)
     */
    public static function convertOSSToInternalEndpoint(string $endpoint): string
    {
        if (empty($endpoint)) {
            return '';
        }

        // Parse the endpoint to handle both with and without protocol
        $parsedUrl = parse_url($endpoint);
        $host = $parsedUrl['host'] ?? $endpoint;
        $scheme = $parsedUrl['scheme'] ?? 'https';

        // Convert public OSS endpoint to internal
        // oss-{region}.aliyuncs.com -> oss-{region}-internal.aliyuncs.com
        if (preg_match('/^(oss-[^.]+)\.aliyuncs\.com$/', $host, $matches)) {
            $internalHost = $matches[1] . '-internal.aliyuncs.com';
            return $scheme . '://' . $internalHost;
        }

        // Return original if pattern doesn't match
        return $endpoint;
    }

    /**
     * Convert TOS endpoint to internal network endpoint for STS operations.
     *
     * @param string $endpoint Public endpoint (e.g., https://tos-cn-beijing.volces.com)
     * @return string Internal endpoint (e.g., https://tos-cn-beijing.ivolces.com)
     */
    public static function convertTOSToInternalEndpoint(string $endpoint): string
    {
        if (empty($endpoint)) {
            return '';
        }

        // Parse the endpoint to handle both with and without protocol
        $parsedUrl = parse_url($endpoint);
        $host = $parsedUrl['host'] ?? $endpoint;
        $scheme = $parsedUrl['scheme'] ?? 'https';

        // Convert public TOS endpoint to internal
        // tos-{region}.volces.com -> tos-{region}.ivolces.com
        // tos-s3-{region}.volces.com -> tos-s3-{region}.ivolces.com
        if (preg_match('/^(tos(?:-s3)?-[^.]+)\.volces\.com$/', $host, $matches)) {
            $internalHost = $matches[1] . '.ivolces.com';
            return $scheme . '://' . $internalHost;
        }

        // Return original if pattern doesn't match
        return $endpoint;
    }

    /**
     * Convert public endpoint to internal based on adapter type.
     *
     * @param string $endpoint Original endpoint
     * @param string $adapterName Adapter name (aliyun, tos, etc.)
     * @param bool $useInternal Whether to use internal endpoint
     * @return string Converted endpoint or original if not supported/disabled
     */
    public static function convertToInternalEndpoint(string $endpoint, string $adapterName, bool $useInternal = false): string
    {
        if (! $useInternal) {
            return $endpoint;
        }

        return match ($adapterName) {
            'aliyun' => self::convertOSSToInternalEndpoint($endpoint),
            'tos' => self::convertTOSToInternalEndpoint($endpoint),
            default => $endpoint,
        };
    }

    /**
     * Convert OSS internal endpoint back to public endpoint.
     *
     * @param string $endpoint Internal endpoint (e.g., https://oss-cn-hangzhou-internal.aliyuncs.com)
     * @return string Public endpoint (e.g., https://oss-cn-hangzhou.aliyuncs.com)
     */
    public static function convertOSSToPublicEndpoint(string $endpoint): string
    {
        // Parse the endpoint to handle both with and without protocol
        $parsedUrl = parse_url($endpoint);
        $host = $parsedUrl['host'] ?? $endpoint;
        $scheme = $parsedUrl['scheme'] ?? 'https';

        // Convert internal OSS endpoint to public
        // oss-{region}-internal.aliyuncs.com -> oss-{region}.aliyuncs.com
        if (preg_match('/^(oss-[^.]+)-internal\.aliyuncs\.com$/', $host, $matches)) {
            $publicHost = $matches[1] . '.aliyuncs.com';
            return $scheme . '://' . $publicHost;
        }

        // Return original if pattern doesn't match
        return $endpoint;
    }

    /**
     * Convert TOS internal endpoint back to public endpoint.
     *
     * @param string $endpoint Internal endpoint (e.g., https://tos-cn-beijing.ivolces.com)
     * @return string Public endpoint (e.g., https://tos-cn-beijing.volces.com)
     */
    public static function convertTOSToPublicEndpoint(string $endpoint): string
    {
        // Parse the endpoint to handle both with and without protocol
        $parsedUrl = parse_url($endpoint);
        $host = $parsedUrl['host'] ?? $endpoint;
        $scheme = $parsedUrl['scheme'] ?? 'https';

        // Convert internal TOS endpoint to public
        // tos-{region}.ivolces.com -> tos-{region}.volces.com
        // tos-s3-{region}.ivolces.com -> tos-s3-{region}.volces.com
        if (preg_match('/^(tos(?:-s3)?-[^.]+)\.ivolces\.com$/', $host, $matches)) {
            $publicHost = $matches[1] . '.volces.com';
            return $scheme . '://' . $publicHost;
        }

        // Return original if pattern doesn't match
        return $endpoint;
    }

    /**
     * Convert internal endpoint back to public based on adapter type.
     *
     * @param string $endpoint Internal endpoint
     * @param string $adapterName Adapter name (aliyun, tos, etc.)
     * @return string Public endpoint or original if not supported
     */
    public static function convertToPublicEndpoint(string $endpoint, string $adapterName): string
    {
        return match ($adapterName) {
            'aliyun' => self::convertOSSToPublicEndpoint($endpoint),
            'tos' => self::convertTOSToPublicEndpoint($endpoint),
            default => $endpoint,
        };
    }
}
