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
		opts: &options{},
		merged: map[string]interface{}{
			"infra": map[string]interface{}{
				"minio": map[string]interface{}{
					"provisioning": map[string]interface{}{
						"buckets": []interface{}{
							map[string]interface{}{"name": "magic-private", "tags": map[string]interface{}{"type": "private", "app": "magic"}},
							map[string]interface{}{"name": "magic-public", "tags": map[string]interface{}{"type": "public", "app": "magic"}},
							map[string]interface{}{"name": "magic-sandbox", "tags": map[string]interface{}{"type": "private", "app": "magic-sandbox"}},
						},
					},
				},
			},
		},
	}
	reg := newInfraRegistry(t.TempDir())
	stage := newMagicStage(d, reg)
	reg.MinIO.Users = []MinIOUser{
		{Username: "magic", Password: "magic-secret"},
		{Username: "magic-sandbox", Password: "sandbox-secret"},
	}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic-private", Tags: map[string]string{"app": "magic", "type": "private"}},
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
		opts: &options{},
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
	reg := newInfraRegistry(t.TempDir())
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
		opts:   &options{},
		merged: map[string]interface{}{
			"infra": map[string]interface{}{},
		},
	}
	reg := newInfraRegistry(t.TempDir())
	stage := newMagicStage(d, reg)
	reg.MinIO.Users = []MinIOUser{
		{Username: "magic", Password: "magic-secret"},
		{Username: "magic-sandbox", Password: "sandbox-secret"},
	}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic-private", Tags: map[string]string{"app": "magic", "type": "private"}},
		{Name: "magic-public", Tags: map[string]string{"app": "magic", "type": "public"}},
		{Name: "magic-sandbox", Tags: map[string]string{"app": "magic-sandbox", "type": "private"}},
	}

	err := stage.Prep(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "magic-private", stage.fileDriver.Minio.Private.Bucket)
	assert.Equal(t, "magic-public", stage.fileDriver.Minio.Public.Bucket)
	assert.Equal(t, "magic-sandbox", stage.fileDriver.Minio.Sandbox.Bucket)
}

func TestNewMagicStage_RegistersMinIOPolicyDefinitions(t *testing.T) {
	reg := newInfraRegistry(t.TempDir())
	d := &Deployer{opts: &options{}}
	_ = newMagicStage(d, reg)

	magicSpec := reg.resources["magic"][KindMinIO].(MinIOSpec)
	require.Equal(t, []string{"magic-access-policy"}, magicSpec.Policies)
	require.Len(t, magicSpec.PolicyDefinitions, 1)
	stmts := magicSpec.PolicyDefinitions[0].Statements
	require.Len(t, stmts, 2)
	// bucket-level statement
	assert.Contains(t, stmts[0].Resources, "arn:aws:s3:::magic-private")
	assert.Contains(t, stmts[0].Resources, "arn:aws:s3:::magic-public")
	assert.Contains(t, stmts[0].Resources, "arn:aws:s3:::magic-sandbox")
	assert.Equal(t, []string{"s3:ListBucket", "s3:GetBucketLocation"}, stmts[0].Actions)
	// object-level statement
	assert.Contains(t, stmts[1].Resources, "arn:aws:s3:::magic-private/*")
	assert.Contains(t, stmts[1].Resources, "arn:aws:s3:::magic-public/*")
	assert.Contains(t, stmts[1].Resources, "arn:aws:s3:::magic-sandbox/*")
	assert.Equal(t, []string{
		"s3:GetObject", "s3:PutObject", "s3:DeleteObject",
		"s3:AbortMultipartUpload", "s3:ListMultipartUploadParts",
	}, stmts[1].Actions)
	for _, st := range magicSpec.PolicyDefinitions[0].Statements {
		assert.NotContains(t, st.Actions, "s3:*")
	}
}

func TestNewMagicSandboxStage_RegistersMinIOSandboxAccessPolicy(t *testing.T) {
	reg := newInfraRegistry(t.TempDir())
	d := &Deployer{opts: &options{}}
	_ = newMagicSandboxStage(d, reg)
	spec := reg.resources["magic-sandbox"][KindMinIO].(MinIOSpec)
	require.Equal(t, []string{"magic-sandbox-access-policy"}, spec.Policies)
	require.Len(t, spec.PolicyDefinitions, 1)
	stmts := spec.PolicyDefinitions[0].Statements
	require.Len(t, stmts, 2)
	// bucket-level statement
	assert.Equal(t, []string{"arn:aws:s3:::magic-sandbox"}, stmts[0].Resources)
	assert.Equal(t, []string{"s3:ListBucket", "s3:GetBucketLocation"}, stmts[0].Actions)
	// object-level statement
	assert.Equal(t, []string{"arn:aws:s3:::magic-sandbox/*"}, stmts[1].Resources)
	assert.Equal(t, []string{
		"s3:GetObject", "s3:PutObject", "s3:DeleteObject",
		"s3:AbortMultipartUpload", "s3:ListMultipartUploadParts",
	}, stmts[1].Actions)
	for _, st := range spec.PolicyDefinitions[0].Statements {
		assert.NotContains(t, st.Actions, "s3:*")
	}
}

func TestNewMagicStages_DeployConstructorOrder_SandboxSpecFromSandboxStage(t *testing.T) {
	reg := newInfraRegistry(t.TempDir())
	d := &Deployer{opts: &options{}}
	_ = newMagicStage(d, reg)
	_ = newMagicSandboxStage(d, reg)
	spec := reg.resources["magic-sandbox"][KindMinIO].(MinIOSpec)
	require.Equal(t, []string{"magic-sandbox-access-policy"}, spec.Policies)
	require.Len(t, spec.PolicyDefinitions, 1)
	assert.Equal(t, "magic-sandbox-access-policy", spec.PolicyDefinitions[0].Name)
}
