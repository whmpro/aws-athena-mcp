export interface AthenaConfig {
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  awsRegion?: string;
  defaultCatalog: string;
  defaultDatabase: string;
  defaultWorkgroup: string;
  defaultOutputLocation?: string;
}

export function getConfig(): AthenaConfig {
  return {
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsSessionToken: process.env.AWS_SESSION_TOKEN,
    awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    defaultCatalog: process.env.ATHENA_CATALOG || 'AwsDataCatalog',
    defaultDatabase: process.env.ATHENA_DATABASE || 'default',
    defaultWorkgroup: process.env.ATHENA_WORKGROUP || 'TFP-Primary',
    defaultOutputLocation: process.env.ATHENA_OUTPUT_LOCATION,
  };
}

export function getAwsCliEnv(config: AthenaConfig): Record<string, string> {
  const env: Record<string, string> = {};
  
  // Copy existing environment variables, filtering out undefined values
  Object.entries(process.env).forEach(([key, value]) => {
    if (value !== undefined) {
      env[key] = value;
    }
  });
  
  if (config.awsAccessKeyId) {
    env.AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
  }
  if (config.awsSecretAccessKey) {
    env.AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey;
  }
  if (config.awsSessionToken) {
    env.AWS_SESSION_TOKEN = config.awsSessionToken;
  }
  if (config.awsRegion) {
    env.AWS_REGION = config.awsRegion;
    env.AWS_DEFAULT_REGION = config.awsRegion;
  }
  
  return env;
}