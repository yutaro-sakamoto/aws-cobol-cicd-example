import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

/**
 * DeployEcsPipelineStackのProps
 */
export interface DeployEcsPipelineStackProps extends cdk.StackProps {
  /**
   * ECSサービス
   */
  fargateServiceArnSsmParamVarName: string;
  /**
   * ECSクラスタARN
   */
  clusterArnSsmParamVarName: string;
  /**
   * ECRリポジトリ名
   */
  ecrRepositoryName: string;
}

/**
 * ECSデプロイ用のパイプラインのスタック
 */
export class DeployEcsPipelineStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: DeployEcsPipelineStackProps,
  ) {
    super(scope, id, props);

    //const service = props.ecsService;

    const artifact = new codepipeline.Artifact();

    const service = ecs.FargateService.fromFargateServiceAttributes(
      this,
      "FargateService",
      {
        serviceArn: ssm.StringParameter.valueForStringParameter(
          this,
          props.fargateServiceArnSsmParamVarName,
        ),
        cluster: ecs.Cluster.fromClusterArn(
          this,
          "ExistingCluster",
          ssm.StringParameter.valueForStringParameter(
            this,
            props.clusterArnSsmParamVarName,
          ),
        ),
      },
    );

    new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "EcsBlueGreenPipeline",
      stages: [
        {
          stageName: "Source",
          actions: [
            new codepipeline_actions.EcrSourceAction({
              actionName: "ECR",
              repository: ecr.Repository.fromRepositoryName(
                this,
                "ExistingECRRepository",
                props.ecrRepositoryName,
              ),
              imageTag: "latest",
              output: artifact,
            }),
          ],
        },
        {
          stageName: "Deploy",
          actions: [
            new codepipeline_actions.EcsDeployAction({
              actionName: "ECS",
              service,
              input: artifact,
            }),
          ],
        },
      ],
    });
  }
}
