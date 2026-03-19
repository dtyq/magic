package util

import "fmt"

// BuildServiceURL builds Kubernetes service URL for cluster internal communication
// serviceName: the name of the service (e.g., "sandbox-123")
// namespace: the namespace where the service is located
// port: the port number of the service
// path: optional path to append to the URL (e.g., "/health", "/api/v1/files/notifications")
func BuildServiceURL(serviceName, namespace string, port int, path ...string) string {
	url := fmt.Sprintf("http://%s.%s:%d", serviceName, namespace, port)

	if len(path) > 0 && path[0] != "" {
		url += path[0]
	}

	return url
}
