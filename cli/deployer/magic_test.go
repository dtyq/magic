package deployer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
)

func TestSelectServicePort(t *testing.T) {
	svc := &corev1.Service{
		Spec: corev1.ServiceSpec{
			Ports: []corev1.ServicePort{
				{Name: "metrics", Port: 9125},
				{Name: "mysql", Port: 3307},
			},
		},
	}
	port := selectServicePort(svc, []string{"mysql"}, defaultMySQLPort)
	assert.Equal(t, int32(3307), port)
}

func TestMagicStagePrep_UsesMagicCredentialForSandboxBucket(t *testing.T) {
	d := &Deployer{
		merged: map[string]interface{}{
			"infra": map[string]interface{}{
				"minio": map[string]interface{}{
					"provisioning": map[string]interface{}{
						"buckets": []interface{}{
							map[string]interface{}{"name": "magic", "tags": map[string]interface{}{"type": "private", "app": "magic"}},
							map[string]interface{}{"name": "magic-public", "tags": map[string]interface{}{"type": "public", "app": "magic"}},
							map[string]interface{}{"name": "magic-sandbox", "tags": map[string]interface{}{"type": "private", "app": "magic-sandbox"}},
						},
					},
				},
			},
		},
	}
	reg := newInfraRegistry()
	stage := newMagicStage(d, reg)
	reg.MinIO.Users = []MinIOUser{
		{Username: "magic", Password: "magic-secret"},
		{Username: "magic-sandbox", Password: "sandbox-secret"},
	}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic", Tags: map[string]string{"app": "magic", "type": "private"}},
		{Name: "magic-public", Tags: map[string]string{"app": "magic", "type": "public"}},
		{Name: "magic-sandbox", Tags: map[string]string{"app": "magic-sandbox", "type": "private"}},
	}

	err := stage.Prep(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "magic-secret", stage.fileDriver.Minio.Sandbox.SecretKey)
	assert.Equal(t, "magic", stage.fileDriver.Minio.Sandbox.AccessKey)
	assert.Equal(t, "magic-sandbox", stage.fileDriver.Minio.Sandbox.Bucket)
	assert.Equal(t, "http://infra-minio.infra.svc.cluster.local:9000", stage.fileDriver.Minio.InternalEndpoint)
}

func TestMagicSandboxStagePrep_S3MapUsesAccessKeyFields(t *testing.T) {
	d := &Deployer{
		merged: map[string]interface{}{
			"infra": map[string]interface{}{
				"minio": map[string]interface{}{
					"provisioning": map[string]interface{}{
						"buckets": []interface{}{
							map[string]interface{}{"name": "magic-sandbox", "tags": map[string]interface{}{"type": "private", "app": "magic-sandbox"}},
						},
					},
				},
			},
		},
	}
	reg := newInfraRegistry()
	stage := newMagicSandboxStage(d, reg)
	reg.MinIO.Users = []MinIOUser{{Username: "magic-sandbox", Password: "sandbox-secret"}}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic-sandbox", Tags: map[string]string{"app": "magic-sandbox", "type": "private"}},
	}

	err := stage.Prep(context.Background())
	require.NoError(t, err)

	got := stage.minio.toMap()
	assert.Equal(t, "magic-sandbox", got["accessKey"])
	assert.Equal(t, "sandbox-secret", got["secretKey"])
	assert.Equal(t, "magic-sandbox", got["bucket"])
	_, hasOldAK := got["akId"]
	_, hasOldSK := got["akSecret"]
	assert.False(t, hasOldAK)
	assert.False(t, hasOldSK)
}

func TestMagicStagePrep_UsesRegistryBucketsWhenMergedMissingBuckets(t *testing.T) {
	d := &Deployer{
		merged: map[string]interface{}{
			"infra": map[string]interface{}{},
		},
	}
	reg := newInfraRegistry()
	stage := newMagicStage(d, reg)
	reg.MinIO.Users = []MinIOUser{
		{Username: "magic", Password: "magic-secret"},
		{Username: "magic-sandbox", Password: "sandbox-secret"},
	}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic", Tags: map[string]string{"app": "magic", "type": "private"}},
		{Name: "magic-public", Tags: map[string]string{"app": "magic", "type": "public"}},
		{Name: "magic-sandbox", Tags: map[string]string{"app": "magic-sandbox", "type": "private"}},
	}

	err := stage.Prep(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "magic", stage.fileDriver.Minio.Private.Bucket)
	assert.Equal(t, "magic-public", stage.fileDriver.Minio.Public.Bucket)
	assert.Equal(t, "magic-sandbox", stage.fileDriver.Minio.Sandbox.Bucket)
}
