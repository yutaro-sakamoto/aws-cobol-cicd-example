import { Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as constants from "./constants";

/**
 * Stack props
 */
export interface InfrastructureStackProps extends StackProps {
  /**
   * if true, only synthesize the stack
   */
  synthOnly: boolean;
}

/**
 * A stack for infrastructure
 */
export class InfrastructureStack extends Stack {
  public readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "VPC", {});

    // Create VPC endpoints
    vpc.addInterfaceEndpoint("ECREndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });

    vpc.addInterfaceEndpoint("ECRDockerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    vpc.addInterfaceEndpoint("CloudWatchEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });

    new ec2.GatewayVpcEndpoint(this, "S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      vpc,
    });

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

    this.fargateService = new ecs.FargateService(this, "FargateService", {
      cluster,
      taskDefinition: defaultTaskDefinition,
    });

    (
      this.fargateService.node.tryFindChild("Service") as ecs.CfnService
    ).taskDefinition = props.synthOnly
      ? "dummy"
      : ssm.StringParameter.valueForStringParameter(
          this,
          constants.taskDefinitionArnSsmParamName,
        );
  }
}
