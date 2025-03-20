import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
//import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

/**
 * DeployEcsPipelineStackのProps
 */
export interface DeployEcsPipelineStackProps extends cdk.StackProps {
  /**
   * ECRリポジトリ名
   */
  ecrRepositoryName: string;
  /**
   *
   */
  fargateService: ecs.FargateService;
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

    const artifact = new codepipeline.Artifact();

    const service = props.fargateService;

    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "EcsBlueGreenPipeline",
      pipelineType: codepipeline.PipelineType.V2,
    });

    pipeline.addStage({
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
    });
    pipeline.addStage({
      stageName: "Deploy",
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: "DeployToECS",
          service,
          input: artifact,
        }),
      ],
    });
  }
}
