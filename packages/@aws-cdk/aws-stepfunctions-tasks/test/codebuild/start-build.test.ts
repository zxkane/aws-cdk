import * as codebuild from '@aws-cdk/aws-codebuild';
import * as s3 from '@aws-cdk/aws-s3';
import * as log from '@aws-cdk/aws-logs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { CodeBuildStartBuild } from '../../lib';

let stack: cdk.Stack;
let codebuildProject: codebuild.Project;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();

  codebuildProject = new codebuild.Project(stack, 'Project', {
    projectName: 'MyTestProject',
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        build: {
          commands: [
            'echo "Hello, CodeBuild!"',
          ],
        },
      },
    }),
  });
});

test('Task with only the required parameters', () => {
  // WHEN
  const task = new CodeBuildStartBuild(stack, 'Task', {
    project: codebuildProject,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::codebuild:startBuild.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      ProjectName: {
        Ref: 'ProjectC78D97AD',
      },
    },
  });
});

test('Task with env variables parameters', () => {
  // WHEN
  const task = new CodeBuildStartBuild(stack, 'Task', {
    project: codebuildProject,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    environmentOverride: {
      environmentVariables: {
        env: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: 'prod',
        },
      }
    }
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::codebuild:startBuild.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      ProjectName: {
        Ref: 'ProjectC78D97AD',
      },
      EnvironmentVariablesOverride: [
        {
          Name: 'env',
          Type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          Value: 'prod',
        },
      ],
    },
  });
});

test('Task with env variables parameters using the deprecated environmentVariablesOverride', () => {
  // WHEN
  const task = new CodeBuildStartBuild(stack, 'Task', {
    project: codebuildProject,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    environmentVariablesOverride: {
      env: {
        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        value: 'prod',
      },
    },
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::codebuild:startBuild.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      ProjectName: {
        Ref: 'ProjectC78D97AD',
      },
      EnvironmentVariablesOverride: [
        {
          Name: 'env',
          Type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          Value: 'prod',
        },
      ],
    },
  });
});

test('Task with additional parameters(source, cache, artifacts and so on).', () => {
  const bucket = new s3.Bucket(stack, 'Bucket');
  // WHEN
  const task = new CodeBuildStartBuild(stack, 'Task', {
    project: codebuildProject,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    timeoutOverride: cdk.Duration.seconds(60*60),
    sourceOverride: codebuild.Source.gitHub({
      branchOrRef: 'my-commit-hash',
      owner: 'aws',
      repo: 'aws-cdk'
    }),
    logsConfigOverride: {
      cloudWatchLogs: {
        status: codebuild.ProjectLogConfigStatus.ENABLED,
        group: new log.LogGroup(stack, 'log-group'),
      },
    },
    environmentOverride: {
      computeType: codebuild.ComputeType.LARGE,
    },
    cacheOverride: codebuild.Cache.local(codebuild.LocalCacheMode.SOURCE),
    secondaryArtifactsOverride: [
      codebuild.Artifacts.s3({
        bucket,
      }),
    ],
    secondarySourcesOverride: [
      codebuild.Source.gitHub({
        owner: 'aws',
        repo: 'aws-cdk',
        cloneDepth: 1,
      }),
    ],
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::codebuild:startBuild.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      CacheOverride: {
        type: 'LOCAL',
        modes: [
          'LOCAL_SOURCE_CACHE',
        ],
      },
      ComputeTypeOverride: 'BUILD_GENERAL1_LARGE',
      LogsConfigOverride: {
        cloudWatchLogs: {
          groupName: 'my-project-log-group',
          status: 'status',
        },
      },
      ProjectName: {
        Ref: 'ProjectC78D97AD',
      },
      SecondaryArtifactsOverride: [
        {
          type: 'S3',
          location: {
            Ref: 'Bucket83908E77',
          },
          namespaceType: 'BUILD_ID',
          overrideArtifactName: true,
          packaging: 'ZIP',
        },
      ],
      SecondarySourcesOverride: [
        {
          gitCloneDepth: 1,
          location: 'https://github.com/aws/aws-cdk.git',
          reportBuildStatus: true,
          type: 'GITHUB',
        },
      ],
      SourceVersion: 'my-commit-hash',
      TimeoutInMinutesOverride: 60,
    },
  });
});

test('Task with illegal queuedTimeoutInMinutesOverride parameter', () => {
  expect(() => {
    new CodeBuildStartBuild(stack, 'Task', {
      project: codebuildProject,
      queuedTimeoutOverride: cdk.Duration.seconds(180),
    });
  }).toThrow(
    /The value of property "queuedTimeoutInMinutesOverride" must be between 5 and 480./,
  );
});

test('supports tokens', () => {
  // WHEN
  const task = new CodeBuildStartBuild(stack, 'Task', {
    project: codebuildProject,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    environmentVariablesOverride: {
      ZONE: {
        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        value: sfn.JsonPath.stringAt('$.envVariables.zone'),
      },
    },
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::codebuild:startBuild.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      ProjectName: {
        Ref: 'ProjectC78D97AD',
      },
      EnvironmentVariablesOverride: [
        {
          'Name': 'ZONE',
          'Type': codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          'Value.$': '$.envVariables.zone',
        },
      ],
    },
  });
});


test('Task throws if WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new CodeBuildStartBuild(stack, 'Task', {
      project: codebuildProject,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,RUN_JOB. Received: WAIT_FOR_TASK_TOKEN/,
  );
});
