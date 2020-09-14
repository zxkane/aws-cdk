import * as codebuild from '@aws-cdk/aws-codebuild';
import * as iam from '@aws-cdk/aws-iam';
import * as log from '@aws-cdk/aws-logs';
import * as kms from '@aws-cdk/aws-kms';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * Properties for CodeBuildStartBuild
 */
export interface CodeBuildStartBuildProps extends sfn.TaskStateBaseProps {
  /**
   * CodeBuild project to start
   */
  readonly project: codebuild.IProject;
  /**
   * Build output artifact settings that override, for this build only.
   *
   * @default - the artifacts specified in the build project.
   */
  readonly artifactsOverride?: codebuild.IArtifacts;
  /**
   * A buildspec file declaration that overrides, for this build only.
   *
   * @default - the buildspec specified in the build project.
   */
  readonly buildspecOverride?: codebuild.BuildSpec;
  /**
   * A ProjectCache object specified for this build.
   *
   * @default - the cache specified in the build project.
   */
  readonly cacheOverride?: codebuild.Cache;
  /**
   * The name of a certificate for this build.
   *
   * @default - the certificate specified in the build project.
   */
  readonly certificateOverride?: string;
  /**
   * Specifies if session debugging is enabled for this build.
   *
   * @default - the debug session flag specified in the build project.
   */
  readonly debugSessionEnabled?: boolean;
  /**
   * The AWS Key Management Service (AWS KMS) customer master key (CMK).
   *
   * @default - the encryption key specified in the build project.
   */
  readonly encryptionKeyOverride?: kms.IKey;
  /**
   * BuildEnvironment includes build image, privilege, environment variable that overrides, for this build only.
   * 
   * @default - the build environment specified in the build project.
   */
  readonly environmentOverride?: codebuild.BuildEnvironment;
  /**
   * A container type for this build.
   *
   * @default - the environment type specified in the build project.
   */
  readonly environmentTypeOverride?: codebuild.WindowsImageType | codebuild.LinuxImageType;
  /**
   * A set of environment variables to be used for this build only.
   *
   * @deprecated - use {@link environmentOverride} instead
   * @default - the latest environment variables already defined in the build project.
   */
  readonly environmentVariablesOverride?: { [name: string]: codebuild.BuildEnvironmentVariable };
  /**
   * A unique, case sensitive identifier you provide to ensure the idempotency of the StartBuild request.
   *
   * @default - no idempotency token.
   */
  readonly idempotencyToken?: string;
  /**
   * Log settings for this build.
   *
   * @default - the log config specified in the build project.
   */
  readonly logsConfigOverride?: {
    cloudWatchLogs?: {
      status: codebuild.ProjectLogConfigStatus,
      group?: log.ILogGroup,
      stream?: log.ILogStream,
    },
    s3Logs?: {
      status: codebuild.ProjectLogConfigStatus,
      encryptionDisabled?: boolean,
      location?: string,
    }
  };
  /**
   * The number of minutes a build is allowed to be queued before it times out.
   *
   * @default - the queued timeout specified in the build project.
   */
  readonly queuedTimeoutOverride?: cdk.Duration;
  /**
   * An array of ProjectArtifacts objects.
   *
   * @default - the secondary artifacts specified in the build project.
   */
  readonly secondaryArtifactsOverride?: [codebuild.IArtifacts];
  /**
   * An array of ProjectSource objects.
   *
   * @default - the second sources specified in the build project.
   */
  readonly secondarySourcesOverride?: [codebuild.ISource];
  /**
   * The name of a service role for this build.
   *
   * @default - the name of service role specified in the build project.
   */
  readonly serviceRoleOverride?: string;
  /**
   * The source type, source version defined in the build project.
   *
   * @default - the source specified in the build project.
   */
  readonly sourceOverride?: codebuild.ISource;
  /**
   * The number of build timeout minutes, from 5 to 480 (8 hours).
   *
   * @default - the build timeout specified in the build project.
   */
  readonly timeoutOverride?: cdk.Duration;
}

/**
 * Start a CodeBuild Build as a task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-codebuild.html
 */
export class CodeBuildStartBuild extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: cdk.Construct, id: string, private readonly props: CodeBuildStartBuildProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, CodeBuildStartBuild.SUPPORTED_INTEGRATION_PATTERNS);
    this.validateOverridingParameters(props);

    this.taskMetrics = {
      metricPrefixSingular: 'CodeBuildProject',
      metricPrefixPlural: 'CodeBuildProjects',
      metricDimensions: {
        ProjectArn: this.props.project.projectArn,
      },
    };

    this.taskPolicies = this.configurePolicyStatements();
  }

  private configurePolicyStatements(): iam.PolicyStatement[] {
    let policyStatements = [
      new iam.PolicyStatement({
        resources: [this.props.project.projectArn],
        actions: [
          'codebuild:StartBuild',
          'codebuild:StopBuild',
          'codebuild:BatchGetBuilds',
          'codebuild:BatchGetReports',
        ],
      }),
    ];

    if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
          resources: [
            cdk.Stack.of(this).formatArn({
              service: 'events',
              resource: 'rule/StepFunctionsGetEventForCodeBuildStartBuildRule',
            }),
          ],
        }),
      );
    }

    return policyStatements;
  }

  /**
   * Provides the CodeBuild StartBuild service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    const sourceConfig = this.props.sourceOverride?.bind(this.props.project.stack, this.props.project);
    const secondarySources = this.props.secondarySourcesOverride?.map(source => source.bind(this.props.project.stack, this.props.project));
    return {
      Resource: integrationResourceArn('codebuild', 'startBuild', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        ArtifactsOverride: this.props.artifactsOverride?.bind(this.props.project.stack, this.props.project).artifactsProperty,
        BuildspecOverride: this.props.buildspecOverride?.toBuildSpec(),
        BuildStatusConfigOverride: sourceConfig?.sourceProperty.buildStatusConfig,
        CacheOverride: this.props.cacheOverride?._toCloudFormation(),
        CertificateOverride: this.props.certificateOverride,
        ComputeTypeOverride: this.props.environmentOverride?.computeType,
        DebugSessionEnabled: this.props.debugSessionEnabled,
        EncryptionKeyOverride: this.props.encryptionKeyOverride?.keyArn,
        EnvironmentTypeOverride: this.props.environmentTypeOverride,
        EnvironmentVariablesOverride: this.props.environmentOverride?.environmentVariables ?
          this.serializeEnvVariables(this.props.environmentOverride?.environmentVariables) : 
            (this.props.environmentVariablesOverride
            ? this.serializeEnvVariables(this.props.environmentVariablesOverride)
            : undefined),
        GitCloneDepthOverride: sourceConfig?.sourceProperty.gitCloneDepth,
        GitSubmodulesConfigOverride: sourceConfig?.sourceProperty.gitSubmodulesConfig,
        IdempotencyToken: this.props.idempotencyToken,
        ImageOverride: this.props.environmentOverride?.buildImage?.imageId,
        ImagePullCredentialsTypeOverride: this.props.environmentOverride?.buildImage?.imagePullPrincipalType,
        InsecureSslOverride: sourceConfig?.sourceProperty.insecureSsl,
        LogsConfigOverride: this.props.logsConfigOverride,
        PrivilegedModeOverride: this.props.environmentOverride?.privileged,
        ProjectName: this.props.project.projectName,
        QueuedTimeoutInMinutesOverride: this.props.queuedTimeoutOverride?.toMinutes(),
        RegistryCredentialOverride: this.props.environmentOverride?.buildImage?.secretsManagerCredentials ? {
          credentialProvider: 'SECRETS_MANAGER',
          credential: this.props.environmentOverride?.buildImage?.secretsManagerCredentials.secretArn,
        } : undefined,
        ReportBuildStatusOverride: sourceConfig?.sourceProperty.reportBuildStatus,
        SecondaryArtifactsOverride: this.props.secondaryArtifactsOverride?.map(artifact =>
          artifact.bind(this.props.project.stack, this.props.project).artifactsProperty,
        ),
        SecondarySourcesOverride: secondarySources?.map(source => source.sourceProperty),
        SecondarySourcesVersionOverride: secondarySources?.map(source => {
          return {
            sourceIdentifier: source.sourceProperty.sourceIdentifier,
            sourceVersion: source.sourceVersion,
          }
        }),
        ServiceRoleOverride: this.props.serviceRoleOverride,
        SourceAuthOverride: sourceConfig?.sourceProperty.auth,
        SourceLocationOverride: sourceConfig?.sourceProperty.location,
        SourceTypeOverride: this.props.sourceOverride?.type,
        SourceVersion: sourceConfig?.sourceVersion,
        TimeoutInMinutesOverride: this.props.timeoutOverride?.toMinutes(),
      }),
    };
  }

  private serializeEnvVariables(environmentVariables: { [name: string]: codebuild.BuildEnvironmentVariable }) {
    return Object.keys(environmentVariables).map(name => ({
      Name: name,
      Type: environmentVariables[name].type || codebuild.BuildEnvironmentVariableType.PLAINTEXT,
      Value: environmentVariables[name].value,
    }));
  }

  private validateOverridingParameters(props: CodeBuildStartBuildProps) {
    if (props.queuedTimeoutOverride && (props.queuedTimeoutOverride.toMinutes() < 5
      || props.queuedTimeoutOverride.toMinutes() > 480)) {
      throw new Error('The value of property "queuedTimeoutOverride" must be between 5 and 480 minutes.');
    }
    if (props.secondaryArtifactsOverride && props.secondaryArtifactsOverride.length > 12) {
      throw new Error('The maximum array length of property "secondaryArtifactsOverride" is 12.');
    }
    if (props.secondarySourcesOverride && props.secondarySourcesOverride.length > 12) {
      throw new Error('The maximum array length of property "secondarySourcesOverride" is 12.');
    }
    if (props.serviceRoleOverride && props.serviceRoleOverride.length < 1) {
      throw new Error('The minimum length of property "serviceRoleOverride" is 1.');
    }
    if (props.timeoutOverride && (props.timeoutOverride.toMinutes() < 5
      || props.timeoutOverride.toMinutes() > 480)) {
      throw new Error('The value of property "timeoutOverride" must be between 5 and 480 minutes.');
    }
  }
}
