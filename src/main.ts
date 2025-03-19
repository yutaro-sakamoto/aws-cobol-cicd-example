import { App, Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { DeployEcsPipelineStack } from "./deploy-ecs-pipeline-stack";
import * as dotenv from "dotenv";
import * as constants from "./constants";

dotenv.config();

/**
 * サンプルのスタック
 */
export class EcrStack extends Stack {
  public readonly ecrRepository: ecr.Repository;
  /**
   * A constructor
   * @param scope scope
   * @param id id
   * @param props properties of this stack
   */
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);

    this.ecrRepository = new ecr.Repository(this, "ECRRepository", {
      repositoryName: constants.ecrRepositoryName,
      imageScanOnPush: true,
    });

    const pipeline = new codepipeline.Pipeline(this, "ApplicationPipeline", {
      pipelineName: "ApplicationPipeline",
      pipelineType: codepipeline.PipelineType.V2,
    });

    new CfnOutput(this, "applicationPipelineName", {
      value: pipeline.pipelineName,
    });

    NagSuppressions.addResourceSuppressions(
      pipeline.artifactBucket.encryptionKey!,
      [
        {
          id: "AwsSolutions-KMS5",
          reason: "This key is used for the artifact bucket.",
        },
      ],
    );

    const sourceOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: "GitHubSource",
          owner: "yutaro-sakamoto",
          repo: "aws-cobol-cicd-example",
          branch: "dev",
          output: sourceOutput,
          connectionArn:
            process.env.AWS_CODECONNECTIONS_ARN || "aws_codeconections_arn",
          triggerOnPush: false,
        }),
      ],
    });

    const buildOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "DockerBuild",
          project: new codebuild.PipelineProject(this, "DockerBuildProject", {
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
              privileged: true,
              environmentVariables: {
                AWS_ACCOUNT_ID: {
                  value: props.env!.account!,
                },
                AWS_DEFAULT_REGION: {
                  value: props.env!.region!,
                },
                IMAGE_REPO_NAME: {
                  value: constants.ecrRepositoryName,
                },
                IMAGE_TAG: {
                  value: "latest",
                },
              },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
              version: "0.2",
              phases: {
                pre_build: {
                  commands: [
                    "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
                  ],
                },
                build: {
                  commands: [
                    "docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG app",
                    "docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG",
                  ],
                },
                post_build: {
                  commands: [
                    "docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG",
                  ],
                },
              },
            }),
            role: new iam.Role(this, "CodeBuildRole", {
              assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
              managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                  "AmazonS3ReadOnlyAccess",
                ),
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                  "AmazonEC2ContainerRegistryPowerUser",
                ),
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                  "CloudWatchLogsFullAccess",
                ),
              ],
            }),
          }),
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        memoryLimitMiB: 512,
        cpu: 256,
      },
    );

    const container = taskDefinition.addContainer("Container", {
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(
          this,
          "ExistingECRRepository",
          constants.ecrRepositoryName,
        ),
      ),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "ecs" }),
    });

    container.addPortMappings({
      containerPort: 80,
    });

    if (!props.synthOnly) {
      new ssm.StringParameter(this, "TaskDefinitionArn", {
        parameterName: constants.taskDefinitionArnSsmParamName,
        stringValue: taskDefinition.taskDefinitionArn,
      });
    }
  }
}

/**
 * A stack for infrastructure
 */
export class InfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "VPC", {});

    const vpcFlowLogGroup = new logs.LogGroup(this, "VpcFlowLogGroup", {
      retention: logs.RetentionDays.ONE_DAY,
    });

    const vpcFlowLogRole = new iam.Role(this, "VpcFlowLogRole", {
      assumedBy: new iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
    });

    new ec2.FlowLog(this, "VpcFlowLog", {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      trafficType: ec2.FlowLogTrafficType.REJECT,
      destination: ec2.FlowLogDestination.toCloudWatchLogs(
        vpcFlowLogGroup,
        vpcFlowLogRole,
      ),
    });

    const cluster = new ecs.Cluster(this, "EcsCluster", {
      vpc,
      containerInsights: true,
    });

    const defaultTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "DefaultTask",
      {
        family: "DefaultTask",
      },
    );

    defaultTaskDefinition.addContainer("DdfaultContainer", {
      containerName: "DefaultContainer",
      image: ecs.ContainerImage.fromRegistry(
        "registry.hub.docker.com/ealen/echo-server",
      ),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "ecs" }),
    });

    const fargateService = new ecs.FargateService(this, "FargateService", {
      cluster,
      taskDefinition: defaultTaskDefinition,
    });

    (
      fargateService.node.tryFindChild("Service") as ecs.CfnService
    ).taskDefinition = props.synthOnly
      ? "dummy"
      : ssm.StringParameter.valueForStringParameter(
          this,
          constants.taskDefinitionArnSsmParamName,
        );

    if (!props.synthOnly) {
      new ssm.StringParameter(this, "FargateServiceArn", {
        parameterName: constants.taskDefinitionArnSsmParamName,
        stringValue: fargateService.serviceArn,
      });
      new ssm.StringParameter(this, "ClusterArn", {
        parameterName: constants.clusterArnParamName,
        stringValue: cluster.clusterArn,
      });
    }
  }
}

/**
 * Stack props
 */
interface MyStackProps extends StackProps {
  /**
   * if true, only synthesize the stack
   */
  synthOnly: boolean;
}
// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const stackProps = {
  env: devEnv,
  synthOnly: process.env.CDK_SYNTH_ONLY
    ? process.env.CDK_SYNTH_ONLY === "true"
    : false,
};

const app = new App();

const stack = new EcrStack(app, "aws-cobol-cicd-example-dev", stackProps);
const infrastructureStack = new InfrastructureStack(
  app,
  "aws-cobol-cicd-example-dev-infrastructures",
  stackProps,
);

const deployEcsPipelineStack = new DeployEcsPipelineStack(
  app,
  "aws-cobol-cicd-example-dev-ecs-pipeline",
  {
    env: devEnv,
    ecrRepositoryName: constants.ecrRepositoryName,
    fargateServiceArnSsmParamVarName: constants.fargateServiceArnParamName,
    clusterArnSsmParamVarName: constants.clusterArnParamName,
  },
);

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
NagSuppressions.addStackSuppressions(stack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
NagSuppressions.addStackSuppressions(infrastructureStack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
NagSuppressions.addStackSuppressions(deployEcsPipelineStack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
app.synth();
