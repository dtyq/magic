package deployer

import (
	"context"
	"fmt"

	"github.com/dtyq/magicrew-cli/chart"
	"github.com/dtyq/magicrew-cli/registry"
	corev1 "k8s.io/api/core/v1"
)

const (
	infraMySQLServiceName    = "infra-mysql"
	infraRedisServiceName    = "infra-redis-master"
	infraRabbitMQServiceName = "infra-rabbitmq"
	infraMinIOServiceName    = "infra-minio"

	defaultMySQLHost    = "infra-mysql.infra.svc.cluster.local"
	defaultMySQLPort    = 3306
	defaultRedisHost    = "infra-redis-master.infra.svc.cluster.local"
	defaultRedisPort    = 6379
	defaultRabbitMQHost = "infra-rabbitmq.infra.svc.cluster.local"
	defaultRabbitMQPort = 5672
	defaultMinIOHost = "infra-minio.infra.svc.cluster.local"
	defaultMinIOPort = 9000
)

// InfraStage installs the infra Helm chart (MySQL, Redis, RabbitMQ, MinIO).
// Prep resolves all credentials and renders the values overlay via Go template.
// Exec merges the overlay into d.merged and runs helm install/upgrade.
type InfraStage struct {
	BaseStage
	d        *Deployer
	registry *InfraRegistry
	// Prep results stored in fields; Exec reads them directly.
	ref       chart.ChartReference
	namespace string
	overlay   map[string]interface{}
}

func newInfraStage(d *Deployer, reg *InfraRegistry) *InfraStage {
	return &InfraStage{
		BaseStage: BaseStage{"install infra"},
		d:         d,
		registry:  reg,
	}
}

func (s *InfraStage) Prep(_ context.Context) error {
	if err := s.registry.ResolveCredentials(); err != nil {
		return fmt.Errorf("resolve infra credentials: %w", err)
	}

	ref, err := s.d.chartRef(releaseNameInfra)
	if err != nil {
		return err
	}
	s.ref = ref

	tmplContent, err := ref.ReadFile("values.tmpl")
	if err != nil {
		return fmt.Errorf("load infra values template: %w", err)
	}
	chartOverlay, err := s.registry.RenderOverlayFromBytes(tmplContent)
	if err != nil {
		return fmt.Errorf("render infra values overlay: %w", err)
	}
	// Wrap the chart-level overlay ({mysql,redis,rabbitmq,minio}) under the "infra" key
	// so it deep-merges correctly into d.merged which uses release names as top-level keys.
	s.overlay = map[string]interface{}{"infra": chartOverlay}

	merged := deepMerge(cloneMap(s.d.merged), s.overlay)
	s.namespace = chartNamespace(merged, releaseNameInfra, defaultInfraNamespace)
	return nil
}

func (s *InfraStage) Exec(ctx context.Context) error {
	merged := deepMerge(cloneMap(s.d.merged), s.overlay)
	// infra/ingress-nginx images come from public sources (Docker Hub, registry.k8s.io).
	// Only proxy through kind-registry when the user opted in by configuring global.imageRegistry,
	// which implies those images are also mirrored to the image registry.
	if s.d.opts.infraUseProxy {
		merged = withRegistryEndpoint(merged, registry.ContainerEndpoint(s.d.opts.registry))
	}
	return installChart(ctx, s.d, releaseNameInfra, s.namespace, s.ref, merged)
}

// ── Connection config types ───────────────────────────────────────────────────

type serviceEndpoint struct {
	host string
	port int32
}

type mysqlConfig struct {
	host, username, password, database string
	port                               int32
}

func (c mysqlConfig) toMap() map[string]interface{} {
	return map[string]interface{}{
		"host":     c.host,
		"port":     c.port,
		"database": c.database,
		"username": c.username,
		"password": c.password,
	}
}

type redisConfig struct {
	host string
	port int32
	auth string
}

func (c redisConfig) toMap() map[string]interface{} {
	return map[string]interface{}{"host": c.host, "port": c.port, "auth": c.auth}
}

type rabbitMQConfig struct {
	host, user, password string
	port                 int32
}

func (c rabbitMQConfig) toMap() map[string]interface{} {
	return map[string]interface{}{
		"host":     c.host,
		"port":     c.port,
		"user":     c.user,
		"password": c.password,
	}
}

type minioConfig struct {
	url, accessKey, secretKey, bucket string
}

func (c minioConfig) toMap() map[string]interface{} {
	return map[string]interface{}{
		"accessKey": c.accessKey,
		"secretKey": c.secretKey,
		"url":       c.url,
		"bucket":    c.bucket,
	}
}

// ── resolveEndpoint methods on credential types ───────────────────────────────
// These are defined here (not in infra_registry.go) because they depend on
// the service endpoint resolution helpers defined in this file.

// resolveEndpoint looks up the MySQL service in the cluster and returns a
// connection-ready mysqlConfig. Falls back to default host/port when unavailable.
func (c MySQLCredential) resolveEndpoint(ctx context.Context, d *Deployer) mysqlConfig {
	ep := resolveInfraServiceEndpoint(ctx, d, infraMySQLServiceName, []string{"mysql"}, defaultMySQLHost, defaultMySQLPort)
	return mysqlConfig{
		host: ep.host, port: ep.port,
		username: c.Username, password: c.Password, database: c.Database,
	}
}

// resolveEndpoint looks up the Redis service and returns a connection-ready redisConfig.
func (c RedisCredential) resolveEndpoint(ctx context.Context, d *Deployer) redisConfig {
	ep := resolveInfraServiceEndpoint(ctx, d, infraRedisServiceName, []string{"redis"}, defaultRedisHost, defaultRedisPort)
	return redisConfig{host: ep.host, port: ep.port, auth: c.Password}
}

// resolveEndpoint looks up the RabbitMQ service and returns a connection-ready rabbitMQConfig.
func (c RabbitMQCredential) resolveEndpoint(ctx context.Context, d *Deployer) rabbitMQConfig {
	ep := resolveInfraServiceEndpoint(ctx, d, infraRabbitMQServiceName, []string{"amqp", "rabbitmq"}, defaultRabbitMQHost, defaultRabbitMQPort)
	return rabbitMQConfig{host: ep.host, port: ep.port, user: c.Username, password: c.Password}
}

func (c MinIOCredential) resolveEndpoint(ctx context.Context, d *Deployer) minioConfig {
	ep := resolveInfraServiceEndpoint(ctx, d, infraMinIOServiceName, []string{"api", "minio", "http"}, defaultMinIOHost, defaultMinIOPort)
	return minioConfig{
		url:       fmt.Sprintf("http://%s:%d", ep.host, ep.port),
		accessKey: c.Username,
		secretKey: c.Password,
	}
}

// ── Service endpoint helpers ──────────────────────────────────────────────────

func resolveInfraServiceEndpoint(ctx context.Context, d *Deployer, serviceName string, preferredPortNames []string, defaultHost string, defaultPort int32) serviceEndpoint {
	fallback := serviceEndpoint{host: defaultHost, port: defaultPort}

	if d.kubeClient == nil {
		d.log.Logw("deploy", "kube client is nil, fallback endpoint for service %s", serviceName)
		return fallback
	}

	svc, err := d.kubeClient.GetService(ctx, defaultInfraNamespace, serviceName)
	if err != nil {
		d.log.Logw("deploy", "get service %s/%s failed, fallback endpoint: %v", defaultInfraNamespace, serviceName, err)
		return fallback
	}

	host := serviceHost(svc, defaultInfraNamespace)
	if host == "" {
		host = defaultHost
	}
	return serviceEndpoint{host: host, port: selectServicePort(svc, preferredPortNames, defaultPort)}
}

func serviceHost(svc *corev1.Service, namespace string) string {
	if svc == nil {
		return ""
	}
	if svc.Spec.ClusterIP != "" && svc.Spec.ClusterIP != "None" {
		return svc.Spec.ClusterIP
	}
	return fmt.Sprintf("%s.%s.svc.cluster.local", svc.Name, namespace)
}

func selectServicePort(svc *corev1.Service, preferredNames []string, defaultPort int32) int32 {
	if svc == nil || len(svc.Spec.Ports) == 0 {
		return defaultPort
	}
	for _, name := range preferredNames {
		for _, p := range svc.Spec.Ports {
			if p.Name == name {
				return p.Port
			}
		}
	}
	for _, p := range svc.Spec.Ports {
		if p.Port == defaultPort {
			return p.Port
		}
	}
	return svc.Spec.Ports[0].Port
}
