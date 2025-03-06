import { App, Stack, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * サンプルのスタック
 */
export class EcrStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const ecrRepositoryName = "my-ecr-repo";
    new ecr.Repository(this, "ECRRepository", {
      repositoryName: ecrRepositoryName,
    });

    const pipeline = new codepipeline.Pipeline(this, "ApplicationPipeline", {
      pipelineName: "ApplicationPipeline",
      pipelineType: codepipeline.PipelineType.V2,
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
          triggerOnPush: true,
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
                  value: ecrRepositoryName,
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
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stack = new EcrStack(app, "aws-cobol-cicd-example-dev", { env: devEnv });
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
NagSuppressions.addStackSuppressions(stack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
app.synth();
