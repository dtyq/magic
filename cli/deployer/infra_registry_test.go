package deployer

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestRegistry creates an InfraRegistry that persists to a temp file.
func newTestRegistry(t *testing.T) *InfraRegistry {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), infraCredentialsFileName)
	reg := newInfraRegistry()
	reg.persistPathFunc = func() (string, error) { return tmpFile, nil }
	return reg
}

// ── Registration ─────────────────────────────────────────────────────────────

func TestInfraRegistry_Register_Accumulates(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(
		InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic", Username: "magic"}},
		InfraResource{App: "magic", Spec: RedisSpec{Username: "magic", ACLRules: "+@all ~* &*"}},
	)
	reg.Register(
		InfraResource{App: "magic-sandbox", Spec: MySQLSpec{Database: "magic_sandbox", Username: "magic_sandbox"}},
	)
	assert.Len(t, reg.resources, 2)                  // 2 distinct apps
	assert.Len(t, reg.resources["magic"], 2)         // magic has 2 kinds registered
	assert.Len(t, reg.resources["magic-sandbox"], 1) // magic-sandbox has 1 kind
}

// ── ResolveCredentials: generation ───────────────────────────────────────────

func TestInfraRegistry_ResolveCredentials_GeneratesPasswords(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(
		InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic", Username: "magic"}},
		InfraResource{App: "magic", Spec: RedisSpec{Username: "magic", ACLRules: "+@all ~* &*"}},
		InfraResource{App: "magic", Spec: RabbitMQSpec{VHost: "magic", Username: "magic", Tags: "administrator"}},
		InfraResource{App: "magic", Spec: MinIOSpec{
			Username: "magic",
			Policies: []string{"magic-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name:       "magic-access-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
			Buckets: []MinIOBucket{
				{
					Name:       "magic",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   true,
					Tags:       map[string]string{"app": "magic", "type": "private"},
				},
			},
		}},
	)
	require.NoError(t, reg.ResolveCredentials())

	assert.NotEmpty(t, reg.MySQL.RootPassword)
	require.Len(t, reg.MySQL.Users, 1)
	assert.NotEmpty(t, reg.MySQL.Users[0].Password)

	assert.NotEmpty(t, reg.Redis.AdminPassword)
	require.Len(t, reg.Redis.Users, 1)
	assert.NotEmpty(t, reg.Redis.Users[0].Password)

	assert.NotEmpty(t, reg.RabbitMQ.AdminPassword)
	require.Len(t, reg.RabbitMQ.Users, 1)
	assert.NotEmpty(t, reg.RabbitMQ.Users[0].Password)

	assert.NotEmpty(t, reg.MinIO.RootPassword)
	require.Len(t, reg.MinIO.Users, 1)
	assert.NotEmpty(t, reg.MinIO.Users[0].Password)
}

func TestInfraRegistry_ResolveCredentials_CollectsBucketsFromSpecs(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(
		InfraResource{App: "magic", Spec: MinIOSpec{
			Username: "magic",
			Policies: []string{"magic-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name:       "magic-access-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
			Buckets: []MinIOBucket{
				{
					Name:       "magic-private",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   true,
					Tags:       map[string]string{"app": "magic", "type": "private"},
				},
				{
					Name:       "magic-public",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   false,
					Tags:       map[string]string{"app": "magic", "type": "public"},
				},
			},
		}},
		InfraResource{App: "magic-sandbox", Spec: MinIOSpec{
			Username: "magic-sandbox",
			Policies: []string{"sandbox-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name:       "sandbox-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::sandbox/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
			Buckets: []MinIOBucket{
				{
					Name:       "sandbox-private",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   true,
					Tags:       map[string]string{"app": "magic-sandbox", "type": "private"},
				},
			},
		}},
	)
	require.NoError(t, reg.ResolveCredentials())
	require.Len(t, reg.MinIO.Buckets, 3)
	assert.Equal(t, "magic-private", reg.MinIO.Buckets[0].Name)
	assert.Equal(t, "magic-public", reg.MinIO.Buckets[1].Name)
	assert.Equal(t, "sandbox-private", reg.MinIO.Buckets[2].Name)
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_DuplicateNameAcrossApps(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(
		InfraResource{App: "magic", Spec: MinIOSpec{
			Username: "magic",
			Policies: []string{"magic-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name: "magic-access-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
		}},
		InfraResource{App: "magic-sandbox", Spec: MinIOSpec{
			Username: "magic-sandbox",
			Policies: []string{"magic-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name: "magic-access-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic-sandbox/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
		}},
	)
	err := reg.ResolveCredentials()
	require.Error(t, err)
	assert.ErrorContains(t, err, "magic-access-policy")
	assert.ErrorContains(t, err, "magic")
	assert.ErrorContains(t, err, "magic-sandbox")
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_DuplicateNameWithinSpec(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic",
		Policies: []string{"magic-access-policy"},
		PolicyDefinitions: []MinIOPolicy{
			{Name: "magic-access-policy", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
			{Name: "magic-access-policy", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
		},
	}})
	err := reg.ResolveCredentials()
	require.Error(t, err)
	assert.ErrorContains(t, err, "magic")
	assert.ErrorContains(t, err, "magic-access-policy")
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_EmptyPolicyName(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic",
		Policies: []string{"ok-policy"},
		PolicyDefinitions: []MinIOPolicy{
			{Name: "   ", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::x/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
		},
	}})
	err := reg.ResolveCredentials()
	require.Error(t, err)
	assert.ErrorContains(t, err, "magic")
	assert.ErrorContains(t, err, "empty")
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_MissingReference(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic",
		Policies: []string{"missing-policy"},
		PolicyDefinitions: []MinIOPolicy{
			{Name: "other-policy", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
		},
	}})
	err := reg.ResolveCredentials()
	require.Error(t, err)
	assert.ErrorContains(t, err, "magic")
	assert.ErrorContains(t, err, "missing-policy")
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_EmptyPolicyReferenceName(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic",
		Policies: []string{"  "},
		PolicyDefinitions: []MinIOPolicy{
			{Name: "defined-only", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
		},
	}})
	err := reg.ResolveCredentials()
	require.Error(t, err)
	assert.ErrorContains(t, err, "magic")
	assert.ErrorContains(t, err, "empty")
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_SortedByName(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(
		InfraResource{App: "app-b", Spec: MinIOSpec{
			Username: "user-b",
			Policies: []string{"zebra-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{Name: "zebra-policy", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::z/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
			},
		}},
		InfraResource{App: "app-a", Spec: MinIOSpec{
			Username: "user-a",
			Policies: []string{"alpha-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{Name: "alpha-policy", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::a/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
			},
		}},
	)
	require.NoError(t, reg.ResolveCredentials())
	require.Len(t, reg.MinIO.Policies, 2)
	assert.Equal(t, "alpha-policy", reg.MinIO.Policies[0].Name)
	assert.Equal(t, "zebra-policy", reg.MinIO.Policies[1].Name)
}

func TestInfraRegistry_ResolveCredentials_MinIOPolicies_PersistedPoliciesOverwrittenBySpecs(t *testing.T) {
	tmpFile := filepath.Join(t.TempDir(), infraCredentialsFileName)
	stale := []byte(`minio:
  rootPassword: seeded-root
  policies:
    - name: stale-only
      statements:
        - resources: ["arn:aws:s3:::old/*"]
          effect: Allow
          actions: ["s3:*"]
  users: []
  buckets: []
`)
	require.NoError(t, os.WriteFile(tmpFile, stale, 0o600))
	reg := newInfraRegistry()
	reg.persistPathFunc = func() (string, error) { return tmpFile, nil }
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic",
		Policies: []string{"live-policy"},
		PolicyDefinitions: []MinIOPolicy{
			{Name: "live-policy", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::live/*"}, Effect: "Allow", Actions: []string{"s3:GetObject"}}}},
		},
	}})
	require.NoError(t, reg.ResolveCredentials())
	require.Len(t, reg.MinIO.Policies, 1)
	assert.Equal(t, "live-policy", reg.MinIO.Policies[0].Name)
	data, err := os.ReadFile(tmpFile)
	require.NoError(t, err)
	assert.Contains(t, string(data), "live-policy")
	assert.NotContains(t, string(data), "stale-only")
}

func TestInfraRegistry_ResolveCredentials_PersistsAndReuses(t *testing.T) {
	tmpFile := filepath.Join(t.TempDir(), infraCredentialsFileName)

	newReg := func() *InfraRegistry {
		reg := newInfraRegistry()
		reg.persistPathFunc = func() (string, error) { return tmpFile, nil }
		reg.Register(
			InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic", Username: "magic"}},
		)
		return reg
	}

	// First run: generates and persists.
	reg1 := newReg()
	require.NoError(t, reg1.ResolveCredentials())
	require.Len(t, reg1.MySQL.Users, 1)
	first := reg1.MySQL.Users[0].Password
	assert.NotEmpty(t, first)

	// Second run: must reuse the persisted password.
	reg2 := newReg()
	require.NoError(t, reg2.ResolveCredentials())
	require.Len(t, reg2.MySQL.Users, 1)
	assert.Equal(t, first, reg2.MySQL.Users[0].Password, "should reuse persisted password")
}

func TestInfraRegistry_ResolveCredentials_DeduplicatesUsers(t *testing.T) {
	reg := newTestRegistry(t)
	// Two apps register the same MySQL username → single user+password entry.
	reg.Register(
		InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic", Username: "shared_user"}},
		InfraResource{App: "other", Spec: MySQLSpec{Database: "other_db", Username: "shared_user"}},
	)
	require.NoError(t, reg.ResolveCredentials())
	assert.Len(t, reg.MySQL.Users, 1)
}

func TestInfraRegistry_ResolveCredentials_CredentialFileHas0600Perms(t *testing.T) {
	tmpFile := filepath.Join(t.TempDir(), infraCredentialsFileName)
	reg := newInfraRegistry()
	reg.persistPathFunc = func() (string, error) { return tmpFile, nil }
	require.NoError(t, reg.ResolveCredentials())

	info, err := os.Stat(tmpFile)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm())
}

// ── Typed Getters ─────────────────────────────────────────────────────────────

func TestInfraRegistry_GetMySQL_ReturnsCorrectCredential(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic_db", Username: "magic_user"}})
	require.NoError(t, reg.ResolveCredentials())

	cred := reg.GetMySQL("magic")
	assert.Equal(t, "magic_user", cred.Username)
	assert.Equal(t, "magic_db", cred.Database)
	assert.NotEmpty(t, cred.Password)
}

func TestInfraRegistry_GetRabbitMQ_ReturnsCorrectCredential(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: RabbitMQSpec{VHost: "magic_vhost", Username: "magic_rabbit", Tags: "administrator"}})
	require.NoError(t, reg.ResolveCredentials())

	cred := reg.GetRabbitMQ("magic")
	assert.Equal(t, "magic_rabbit", cred.Username)
	assert.Equal(t, "magic_vhost", cred.VHost)
	assert.NotEmpty(t, cred.Password)
}

func TestInfraRegistry_GetRedis_ReturnsCorrectCredential(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: RedisSpec{Username: "magic_redis", ACLRules: "+@all ~* &*"}})
	require.NoError(t, reg.ResolveCredentials())

	cred := reg.GetRedis("magic")
	assert.Equal(t, "magic_redis", cred.Username)
	assert.Equal(t, reg.Redis.AdminPassword, cred.Password)
}

func TestInfraRegistry_GetRedis_ReturnsEmptyForUnknownApp(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: RedisSpec{Username: "magic_redis", ACLRules: "+@all ~* &*"}})
	require.NoError(t, reg.ResolveCredentials())

	cred := reg.GetRedis("nonexistent")
	assert.Equal(t, RedisCredential{}, cred)
}

func TestInfraRegistry_GetMinIO_ReturnsCorrectCredential(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic_minio",
		Policies: []string{"p1"},
		PolicyDefinitions: []MinIOPolicy{
			{Name: "p1", Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::b/*"}, Effect: "Allow", Actions: []string{"s3:*"}}}},
		},
	}})
	require.NoError(t, reg.ResolveCredentials())

	cred, err := reg.GetMinIO("magic")
	require.NoError(t, err)
	assert.Equal(t, "magic_minio", cred.Username)
	assert.NotEmpty(t, cred.Password)
}

func TestInfraRegistry_GetMinIO_ErrorForUnknownApp(t *testing.T) {
	reg := newTestRegistry(t)
	require.NoError(t, reg.ResolveCredentials())
	_, err := reg.GetMinIO("nonexistent")
	assert.ErrorContains(t, err, "nonexistent")
}

// ── Template Rendering ────────────────────────────────────────────────────────

const testInfraValuesTemplate = `
mysql:
  auth:
    rootPassword: {{ quote .MySQL.RootPassword }}
  initdbScripts:
    init.sql: |
{{ .MySQL.InitSQL }}

redis:
  auth:
    password: {{ quote .Redis.AdminPassword }}
  commonConfiguration: |
    {{- range .Redis.Users }}
    user {{ .Username }} on >{{ .Password }} {{ .ACLRules }}
    {{- end }}

rabbitmq:
  auth:
    password: {{ quote .RabbitMQ.AdminPassword }}
  extraSecrets:
    load-definition:
      load_definition.json: |
        {{ .RabbitMQ.LoadDefinitionJSON }}

minio:
  auth:
    rootPassword: {{ quote .MinIO.RootPassword }}
  provisioning:
    buckets:
      {{- range .MinIO.Buckets }}
      - name: {{ .Name }}
        region: {{ .Region }}
      {{- end }}
    policies:
      {{- range .MinIO.Policies }}
      - name: {{ quote .Name }}
        statements:
          {{- range .Statements }}
          - resources:
              {{- range .Resources }}
              - {{ quote . }}
              {{- end }}
            effect: {{ quote .Effect }}
            actions:
              {{- range .Actions }}
              - {{ quote . }}
              {{- end }}
          {{- end }}
      {{- end }}
    extraCommands:
      - mc anonymous set download provisioning/magic-public
    users:
      {{- range .MinIO.Users }}
      - username: {{ .Username }}
        password: {{ .Password }}
      {{- end }}
`

func TestInfraRegistry_RenderOverlay_RendersMinIOPolicies(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(InfraResource{App: "magic", Spec: MinIOSpec{
		Username: "magic",
		Policies: []string{"magic-access-policy"},
		PolicyDefinitions: []MinIOPolicy{
			{
				Name:       "magic-access-policy",
				Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
			},
		},
	}})
	require.NoError(t, reg.ResolveCredentials())
	overlay, err := reg.RenderOverlayFromBytes([]byte(testInfraValuesTemplate))
	require.NoError(t, err)
	minio := mapValue(overlay["minio"])
	provisioning := mapValue(minio["provisioning"])
	policies, ok := provisioning["policies"].([]interface{})
	require.True(t, ok, "provisioning.policies should be a YAML sequence")
	require.Len(t, policies, 1)
	p0 := mapValue(policies[0])
	assert.Equal(t, "magic-access-policy", p0["name"])
	stmts, ok := p0["statements"].([]interface{})
	require.True(t, ok)
	require.Len(t, stmts, 1)
	st0 := mapValue(stmts[0])
	res, ok := st0["resources"].([]interface{})
	require.True(t, ok)
	require.Len(t, res, 1)
	assert.Equal(t, "arn:aws:s3:::magic/*", res[0])
	assert.Equal(t, "Allow", st0["effect"])
	acts, ok := st0["actions"].([]interface{})
	require.True(t, ok)
	require.Len(t, acts, 1)
	assert.Equal(t, "s3:*", acts[0])
}

func TestInfraRegistry_RenderOverlay_ProducesValidYAML(t *testing.T) {
	reg := newTestRegistry(t)
	reg.Register(
		InfraResource{App: "magic", Spec: MySQLSpec{Database: "magic", Username: "magic"}},
		InfraResource{App: "magic-sandbox", Spec: MySQLSpec{Database: "magic_sandbox", Username: "magic_sandbox"}},
		InfraResource{App: "magic", Spec: RabbitMQSpec{VHost: "magic", Username: "magic", Tags: "administrator"}},
		InfraResource{App: "magic", Spec: RedisSpec{Username: "magic", ACLRules: "+@all ~* &*"}},
		InfraResource{App: "magic", Spec: MinIOSpec{
			Username: "magic",
			Policies: []string{"magic-access-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name:       "magic-access-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::magic/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
			Buckets: []MinIOBucket{
				{
					Name:       "magic",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   true,
					Tags:       map[string]string{"app": "magic", "type": "private"},
				},
				{
					Name:       "magic-public",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   false,
					Tags:       map[string]string{"app": "magic", "type": "public"},
				},
			},
		}},
		InfraResource{App: "magic-sandbox", Spec: MinIOSpec{
			Username: "magic-sandbox",
			Policies: []string{"sandbox-policy"},
			PolicyDefinitions: []MinIOPolicy{
				{
					Name:       "sandbox-policy",
					Statements: []MinIOPolicyStatement{{Resources: []string{"arn:aws:s3:::sb/*"}, Effect: "Allow", Actions: []string{"s3:*"}}},
				},
			},
			Buckets: []MinIOBucket{
				{
					Name:       "magic-sandbox",
					Region:     "cn-north-1",
					Versioning: "Versioned",
					WithLock:   true,
					Tags:       map[string]string{"app": "magic-sandbox", "type": "private"},
				},
			},
		}},
	)
	require.NoError(t, reg.ResolveCredentials())

	overlay, err := reg.RenderOverlayFromBytes([]byte(testInfraValuesTemplate))
	require.NoError(t, err, "RenderOverlay should succeed")

	// Top-level keys present.
	assert.Contains(t, overlay, "mysql")
	assert.Contains(t, overlay, "redis")
	assert.Contains(t, overlay, "rabbitmq")
	assert.Contains(t, overlay, "minio")

	// MySQL rootPassword injected.
	mysql := mapValue(overlay["mysql"])
	auth := mapValue(mysql["auth"])
	assert.Equal(t, reg.MySQL.RootPassword, auth["rootPassword"])

	// initdbScripts present.
	initdb := mapValue(mysql["initdbScripts"])
	sql, ok := initdb["init.sql"].(string)
	require.True(t, ok, "init.sql should be a string")
	assert.Contains(t, sql, "CREATE DATABASE IF NOT EXISTS `magic`")
	assert.Contains(t, sql, "CREATE DATABASE IF NOT EXISTS `magic_sandbox`")
	assert.Contains(t, sql, "FLUSH PRIVILEGES")

	// Redis password injected.
	redis := mapValue(overlay["redis"])
	redisAuth := mapValue(redis["auth"])
	assert.Equal(t, reg.Redis.AdminPassword, redisAuth["password"])

	// commonConfiguration contains ACL user entry.
	commonCfg, ok := redis["commonConfiguration"].(string)
	require.True(t, ok)
	assert.Contains(t, commonCfg, "user magic on")

	// RabbitMQ load definition secret present.
	rmq := mapValue(overlay["rabbitmq"])
	rmqAuth := mapValue(rmq["auth"])
	assert.Equal(t, reg.RabbitMQ.AdminPassword, rmqAuth["password"])
	extraSecrets := mapValue(rmq["extraSecrets"])
	loadDef := mapValue(extraSecrets["load-definition"])
	assert.Contains(t, loadDef, "load_definition.json")

	// MinIO rootPassword injected and users list replaced.
	minio := mapValue(overlay["minio"])
	minioAuth := mapValue(minio["auth"])
	assert.Equal(t, reg.MinIO.RootPassword, minioAuth["rootPassword"])
	provisioning := mapValue(minio["provisioning"])
	users, ok := provisioning["users"].([]interface{})
	require.True(t, ok)
	assert.Len(t, users, 2)
	buckets, ok := provisioning["buckets"].([]interface{})
	require.True(t, ok)
	assert.Len(t, buckets, 3)
	firstBucket := mapValue(buckets[0])
	assert.Equal(t, "cn-north-1", firstBucket["region"])
	policies, ok := provisioning["policies"].([]interface{})
	require.True(t, ok, "provisioning.policies should be rendered from MinIO.Policies")
	require.Len(t, policies, 2)
	policyNames := []string{
		stringValue(mapValue(policies[0])["name"]),
		stringValue(mapValue(policies[1])["name"]),
	}
	assert.Equal(t, []string{"magic-access-policy", "sandbox-policy"}, policyNames)
	p0 := mapValue(policies[0])
	stmts0, ok := p0["statements"].([]interface{})
	require.True(t, ok)
	require.Len(t, stmts0, 1)
	st00 := mapValue(stmts0[0])
	res00, ok := st00["resources"].([]interface{})
	require.True(t, ok)
	assert.Contains(t, res00, "arn:aws:s3:::magic/*")
	acts00, ok := st00["actions"].([]interface{})
	require.True(t, ok)
	assert.Contains(t, acts00, "s3:*")
	extraCommands, ok := provisioning["extraCommands"].([]interface{})
	require.True(t, ok)
	assert.Equal(t, []interface{}{"mc anonymous set download provisioning/magic-public"}, extraCommands)
}

// ── MagicStage.Prep (replaces the old buildMagicOverlay test) ────────────────

func TestMagicStage_Prep_ReadsFromRegistry(t *testing.T) {
	reg := newTestRegistry(t)
	d := &Deployer{
		merged: map[string]interface{}{
			"infra": map[string]interface{}{
				"minio": map[string]interface{}{
					"provisioning": map[string]interface{}{
						"buckets": []interface{}{
							map[string]interface{}{"name": "magic-private", "tags": map[string]interface{}{"app": "magic", "type": "private"}},
							map[string]interface{}{"name": "magic-public", "tags": map[string]interface{}{"app": "magic", "type": "public"}},
							map[string]interface{}{"name": "magic-sandbox", "tags": map[string]interface{}{"app": "magic-sandbox", "type": "private"}},
						},
					},
				},
			},
		},
	}
	stage := newMagicStage(d, reg)

	// Inject known credentials directly via struct fields so Prep results are deterministic.
	reg.MySQL.Users = []MySQLUser{{Username: "magic", Password: "mysql-pass", Database: "magic"}}
	reg.Redis.AdminPassword = "redis-admin-pass"
	reg.Redis.Users = []RedisUser{{Username: "magic", Password: "redis-pass", ACLRules: "+@all ~* &*"}}
	reg.RabbitMQ.Users = []RabbitMQUser{{Username: "magic", Password: "rabbit-pass", VHost: "magic", Tags: "administrator"}}
	reg.MinIO.Users = []MinIOUser{{Username: "magic", Password: "minio-pass", Policies: []string{"magic-access-policy"}}}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic-private", Tags: map[string]string{"app": "magic", "type": "private"}},
		{Name: "magic-public", Tags: map[string]string{"app": "magic", "type": "public"}},
		{Name: "magic-sandbox", Tags: map[string]string{"app": "magic-sandbox", "type": "private"}},
	}

	require.NoError(t, stage.Prep(context.Background()))

	assert.Equal(t, "magic", stage.mysql.username)
	assert.Equal(t, "mysql-pass", stage.mysql.password)
	assert.Equal(t, "magic", stage.mysql.database)
	assert.Equal(t, defaultMySQLHost, stage.mysql.host)
	assert.Equal(t, int32(defaultMySQLPort), stage.mysql.port)

	assert.Equal(t, "redis-admin-pass", stage.redis.auth)
	assert.Equal(t, defaultRedisHost, stage.redis.host)

	assert.Equal(t, "magic", stage.rabbit.user)
	assert.Equal(t, "rabbit-pass", stage.rabbit.password)
	assert.Equal(t, defaultRabbitMQHost, stage.rabbit.host)

	assert.Equal(t, "minio-pass", stage.fileDriver.Minio.Private.SecretKey)
	assert.Equal(t, "magic", stage.fileDriver.Minio.Private.AccessKey)
	assert.Equal(t, "magic-private", stage.fileDriver.Minio.Private.Bucket)
	assert.Equal(t, "magic-public", stage.fileDriver.Minio.Public.Bucket)
	assert.Equal(t, "magic-sandbox", stage.fileDriver.Minio.Sandbox.Bucket)
}

func TestMagicSandboxStage_Prep_ReadsMinIOFromRegistry(t *testing.T) {
	reg := newTestRegistry(t)
	d := &Deployer{
		merged: map[string]interface{}{
			"infra": map[string]interface{}{
				"minio": map[string]interface{}{
					"provisioning": map[string]interface{}{
						"buckets": []interface{}{
							map[string]interface{}{
								"name": "magic-sandbox",
								"tags": map[string]interface{}{"app": "magic-sandbox", "type": "private"},
							},
						},
					},
				},
			},
		},
	}
	stage := newMagicSandboxStage(d, reg)
	reg.MinIO.Users = []MinIOUser{{Username: "magic-sandbox", Password: "minio-pass", Policies: []string{"magic-sandbox-access-policy"}}}
	reg.MinIO.Buckets = []MinIOBucket{
		{Name: "magic-sandbox", Tags: map[string]string{"app": "magic-sandbox", "type": "private"}},
	}

	require.NoError(t, stage.Prep(context.Background()))

	assert.Equal(t, "magic-sandbox", stage.minio.accessKey)
	assert.Equal(t, "minio-pass", stage.minio.secretKey)
	assert.Equal(t, "magic-sandbox", stage.minio.bucket)
}

// ── resolveInfraServiceEndpoint fallback (previously in magic_test.go) ───────

func TestResolveInfraServiceEndpoint_FallbackWhenNoKubeClient(t *testing.T) {
	d := &Deployer{}
	ep := resolveInfraServiceEndpoint(context.Background(), d, infraMySQLServiceName, []string{"mysql"}, defaultMySQLHost, defaultMySQLPort)
	assert.Equal(t, defaultMySQLHost, ep.host)
	assert.Equal(t, int32(defaultMySQLPort), ep.port)
}
