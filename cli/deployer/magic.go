package deployer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/dtyq/magicrew-cli/registry"
	"go.yaml.in/yaml/v3"
)

const (
	defaultImagePrepullEnabled    = true
	defaultImagePrepullWaitPolicy = "ready"
	defaultImagePrepullMaxWaitSec = 300
	imagePrepullLabelSelector     = "app.kubernetes.io/component=image-prepull"
	nonImagePrepullLabelSelector  = "app.kubernetes.io/component!=image-prepull"
)

// minioCredConfig mirrors values.yaml fileDriver.minio.{private,sandbox}.
type minioCredConfig struct {
	AccessKey string `yaml:"accessKey"`
	SecretKey string `yaml:"secretKey"`
	Bucket    string `yaml:"bucket"`
	RoleArn   string `yaml:"roleArn"`
}

// minioPublicCredConfig mirrors values.yaml fileDriver.minio.public.
type minioPublicCredConfig struct {
	minioCredConfig `yaml:",inline"`
	PublicRead      string `yaml:"publicRead"`
}

// minioDriverConfig mirrors values.yaml fileDriver.minio.
type minioDriverConfig struct {
	Endpoint         string                `yaml:"endpoint"`
	InternalEndpoint string                `yaml:"internalEndpoint"`
	Region           string                `yaml:"region"`
	StsEndpoint      string                `yaml:"stsEndpoint"`
	Private          minioCredConfig       `yaml:"private"`
	Public           minioPublicCredConfig `yaml:"public"`
	Sandbox          minioCredConfig       `yaml:"sandbox"`
}

// fileDriverConfig mirrors values.yaml fileDriver.
type fileDriverConfig struct {
	Driver string            `yaml:"driver"`
	Minio  minioDriverConfig `yaml:"minio"`
}

func (c fileDriverConfig) toMap() (map[string]interface{}, error) {
	data, err := yaml.Marshal(c)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := yaml.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// MagicStage installs the magic Helm chart.
// Its constructor registers all infrastructure resources it needs so that
// InfraStage can collect them during ResolveCredentials.
type MagicStage struct {
	BaseStage
	d        *Deployer
	registry *InfraRegistry
	// Prep results; Exec reads these fields directly.
	mysql      mysqlConfig
	redis      redisConfig
	rabbit     rabbitMQConfig
	fileDriver fileDriverConfig
}

func newMagicStage(d *Deployer, reg *InfraRegistry) *MagicStage {
	reg.Register(
		InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic", Username: "magic"}},
		InfraResource{App: "magic", Spec: RabbitMQSpec{VHost: "magic", Username: "magic", Tags: "administrator"}},
		InfraResource{App: "magic", Spec: RedisSpec{Username: "magic", ACLRules: "+@all ~* &*"}},
		InfraResource{App: "magic", Spec: MinIOSpec{
			Username: "magic",
			Policies: []string{"magic-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name: "magic-access-policy",
					Statements: []MinIOPolicyStatement{
						{
							Resources: []string{
								"arn:aws:s3:::magic-private", "arn:aws:s3:::magic-private/*",
								"arn:aws:s3:::magic-public", "arn:aws:s3:::magic-public/*",
								"arn:aws:s3:::magic-sandbox", "arn:aws:s3:::magic-sandbox/*",
							},
							Effect:  "Allow",
							Actions: []string{"s3:*"},
						},
					},
				},
			},
			Buckets: []MinIOBucket{
				minioBucket("magic-private", "private", "magic"),
				minioBucket("magic-public", "public", "magic"),
			},
		}},
	)
	return &MagicStage{
		BaseStage: BaseStage{"install magic"},
		d:         d,
		registry:  reg,
	}
}

// Prep resolves connection configs after InfraStage has installed the infra chart
// and credentials are available via the registry.
func (s *MagicStage) Prep(ctx context.Context) error {
	s.mysql = s.registry.GetMySQL("magic").resolveEndpoint(ctx, s.d)
	s.redis = s.registry.GetRedis("magic").resolveEndpoint(ctx, s.d)
	s.rabbit = s.registry.GetRabbitMQ("magic").resolveEndpoint(ctx, s.d)

	minioCred, err := s.registry.GetMinIO("magic")
	if err != nil {
		return err
	}
	minioConn := minioCred.resolveEndpoint(ctx, s.d)
	privateBucket, err := resolveMinIOBucketName(s.registry, "magic", "private")
	if err != nil {
		return err
	}
	publicBucket, err := resolveMinIOBucketName(s.registry, "magic", "public")
	if err != nil {
		return err
	}
	sandboxBucket, err := resolveMinIOBucketName(s.registry, "magic-sandbox", "private")
	if err != nil {
		return err
	}
	internalEndpoint := minioConn.url
	externalEndpoint := fmt.Sprintf("http://localhost:%d", s.d.opts.Kind.MinIOHostPort)

	s.fileDriver = fileDriverConfig{
		Driver: "minio",
		Minio: minioDriverConfig{
			Endpoint:         externalEndpoint,
			InternalEndpoint: internalEndpoint,
			Region:           "cn-north-1",
			StsEndpoint:      internalEndpoint,
			Private: minioCredConfig{
				AccessKey: minioConn.accessKey,
				SecretKey: minioConn.secretKey,
				Bucket:    privateBucket,
				RoleArn:   roleArn(privateBucket),
			},
			Public: minioPublicCredConfig{
				minioCredConfig: minioCredConfig{
					AccessKey: minioConn.accessKey,
					SecretKey: minioConn.secretKey,
					Bucket:    publicBucket,
					RoleArn:   roleArn(publicBucket),
				},
				PublicRead: "true",
			},
			Sandbox: minioCredConfig{
				AccessKey: minioConn.accessKey,
				SecretKey: minioConn.secretKey,
				Bucket:    sandboxBucket,
				RoleArn:   roleArn(sandboxBucket),
			},
		},
	}
	return nil
}

func (s *MagicStage) Exec(ctx context.Context) error {
	fdMap, err := s.fileDriver.toMap()
	if err != nil {
		return fmt.Errorf("build fileDriver overlay: %w", err)
	}
	overlay := map[string]interface{}{
		"magic": map[string]interface{}{
			"mysql": s.mysql.toMap(),
			"redis": s.redis.toMap(),
			"amqp":  s.rabbit.toMap(),
			"magic-service": map[string]interface{}{
				"fileDriver": fdMap,
			},
		},
	}
	merged := deepMerge(cloneMap(s.d.merged), overlay)
	// magic images live in our image registry; always route through the local proxy.
	merged = withRegistryEndpoint(merged, registry.ContainerEndpoint(s.d.opts.Registry))
	namespace := chartNamespace(merged, releaseNameMagic, defaultMagicNamespace)
	ref, err := s.d.chartRef(releaseNameMagic)
	if err != nil {
		return err
	}
	return installChart(ctx, s.d, releaseNameMagic, namespace, ref, merged)
}

// MagicSandboxStage installs the magic-sandbox Helm chart.
type MagicSandboxStage struct {
	BaseStage
	d        *Deployer
	registry *InfraRegistry
	// Prep result.
	minio minioConfig
}

func newMagicSandboxStage(d *Deployer, reg *InfraRegistry) *MagicSandboxStage {
	reg.Register(
		InfraResource{App: "magic-sandbox", Spec: MinIOSpec{
			Username: "magic-sandbox",
			Policies: []string{"magic-sandbox-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name: "magic-sandbox-access-policy",
					Statements: []MinIOPolicyStatement{
						{
							Resources: []string{
								"arn:aws:s3:::magic-sandbox",
								"arn:aws:s3:::magic-sandbox/*",
							},
							Effect:  "Allow",
							Actions: []string{"s3:*"},
						},
					},
				},
			},
			Buckets: []MinIOBucket{
				minioBucket("magic-sandbox", "private", "magic-sandbox"),
			},
		}},
	)
	return &MagicSandboxStage{
		BaseStage: BaseStage{"install magic-sandbox"},
		d:         d,
		registry:  reg,
	}
}

func (s *MagicSandboxStage) Prep(ctx context.Context) error {
	minioCred, err := s.registry.GetMinIO("magic-sandbox")
	if err != nil {
		return err
	}
	minioConn := minioCred.resolveEndpoint(ctx, s.d)
	bucket, err := resolveMinIOBucketName(s.registry, "magic-sandbox", "private")
	if err != nil {
		return err
	}
	minioConn.bucket = bucket
	s.minio = minioConn
	return nil
}

func (s *MagicSandboxStage) Exec(ctx context.Context) error {
	overlay := map[string]interface{}{
		"magic-sandbox": map[string]interface{}{
			"sandbox-gateway": map[string]interface{}{
				"s3": s.minio.toMap(),
			},
		},
	}
	merged := deepMerge(cloneMap(s.d.merged), overlay)
	// magic-sandbox images live in our image registry; always route through the local proxy.
	merged = withRegistryEndpoint(merged, registry.ContainerEndpoint(s.d.opts.Registry))
	namespace := chartNamespace(merged, releaseNameMagicSandbox, defaultMagicSandboxNamespace)
	// Remove any stale image-prepull pods (e.g. ImagePullBackOff from a previous
	// deploy) before (re)installing so Helm starts with a clean slate.
	s.cleanupStaleImagePrepull(ctx, namespace)
	ref, err := s.d.chartRef(releaseNameMagicSandbox)
	if err != nil {
		return err
	}
	// Exclude image-prepull pods from the default chart-level ready wait.
	// Their readiness is governed by waitForImagePrepull with configurable policy.
	if err := installChartWithWaitSelector(ctx, s.d, releaseNameMagicSandbox, namespace, ref, merged, nonImagePrepullLabelSelector); err != nil {
		return err
	}
	s.waitForImagePrepull(ctx, namespace, merged)
	return nil
}

func (s *MagicSandboxStage) waitForImagePrepull(ctx context.Context, namespace string, merged map[string]interface{}) {
	cfg := mapValue(mapValue(merged[releaseNameMagicSandbox])["imagePrepull"])
	if !boolFromMapDefault(cfg, "enabled", defaultImagePrepullEnabled) {
		s.d.log.Logi("deploy", "image pre-pull disabled; skip warm-up wait")
		return
	}

	policy := strings.ToLower(strings.TrimSpace(stringFromMap(cfg, "waitPolicy")))
	if policy == "" {
		policy = defaultImagePrepullWaitPolicy
	}
	if policy == "none" {
		s.d.log.Logi("deploy", "image pre-pull wait policy is none; continue deploy without waiting")
		return
	}

	maxWaitSec := intFromMapDefault(cfg, "maxWaitSeconds", defaultImagePrepullMaxWaitSec)
	if maxWaitSec <= 0 {
		s.d.log.Logi("deploy", "image pre-pull maxWaitSeconds <= 0; skip wait")
		return
	}

	waitCtx, cancel := context.WithTimeout(ctx, time.Duration(maxWaitSec)*time.Second)
	defer cancel()
	s.d.log.Logi("deploy", "image pre-pull waiting policy=%s timeout=%ds", policy, maxWaitSec)

	var err error
	switch policy {
	case "scheduled":
		err = s.d.kubeClient.WaitForPodsScheduled(waitCtx, namespace, imagePrepullLabelSelector, time.Duration(maxWaitSec)*time.Second, nil)
	case "ready":
		err = s.d.kubeClient.WaitForPodsReady(waitCtx, namespace, imagePrepullLabelSelector, time.Duration(maxWaitSec)*time.Second, newPodReporter(s.d.log, "image-prepull"))
	default:
		s.d.log.Logw("deploy", "unknown image pre-pull wait policy %q; skip waiting", policy)
		return
	}
	if err != nil {
		s.d.log.Logw("deploy", "image pre-pull wait timed out or failed (%v); continue deploy", err)
		return
	}
	s.d.log.Logi("deploy", "image pre-pull wait condition satisfied (%s)", policy)
}

// cleanupStaleImagePrepull checks whether any existing image-prepull pods are stuck
// in an image-pull failure state (ImagePullBackOff / ErrImagePull). If so, the
// DaemonSet is deleted so that the upcoming Helm install starts with a clean slate.
func (s *MagicSandboxStage) cleanupStaleImagePrepull(ctx context.Context, namespace string) {
	if s.d.kubeClient == nil {
		s.d.log.Logw("deploy", "image-prepull stale-check skipped: kube client not initialized")
		return
	}

	checkCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	hasStale, err := s.d.kubeClient.HasPodsWithImagePullFailure(checkCtx, namespace, imagePrepullLabelSelector)
	if err != nil {
		s.d.log.Logw("deploy", "image-prepull stale-check: %v", err)
		return
	}
	if !hasStale {
		return
	}

	s.d.log.Logi("deploy", "stale image-prepull pods detected (image pull failure); deleting pods before redeploy")
	delCtx, delCancel := context.WithTimeout(ctx, 30*time.Second)
	defer delCancel()
	if err := s.d.kubeClient.DeletePodsByLabel(delCtx, namespace, imagePrepullLabelSelector); err != nil {
		s.d.log.Logw("deploy", "image-prepull pod cleanup: %v", err)
	} else {
		s.d.log.Logi("deploy", "stale image-prepull pods deleted")
	}
}

func roleArn(bucket string) string {
	return fmt.Sprintf("arn:aws:s3:::%s", bucket)
}

func minioBucket(name, typeTag, app string) MinIOBucket {
	return MinIOBucket{
		Name:       name,
		Region:     "cn-north-1",
		Versioning: "Versioned",
		WithLock:   typeTag != "public",
		Tags: map[string]string{
			"type": typeTag,
			"app":  app,
		},
	}
}


func resolveMinIOBucketName(reg *InfraRegistry, app, typeTag string) (string, error) {
	if reg == nil {
		return "", fmt.Errorf("minio registry is nil when resolving bucket for app %q type %q", app, typeTag)
	}
	for _, bucket := range reg.MinIO.Buckets {
		if bucket.Tags["app"] == app && bucket.Tags["type"] == typeTag && bucket.Name != "" {
			return bucket.Name, nil
		}
	}
	return "", fmt.Errorf("minio bucket for app %q type %q not found in registry minio buckets", app, typeTag)
}
