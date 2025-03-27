import { Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as constants from "./constants";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";

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

    const vpc = new ec2.Vpc(this, "VPC", {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      maxAzs: 2,
    });

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

    defaultTaskDefinition.addContainer("DefaultContainer", {
      containerName: "DefaultContainer",
      image: ecs.ContainerImage.fromRegistry(
        "registry.hub.docker.com/ealen/echo-server",
      ),
      portMappings: [
        {
          containerPort: 80,
        },
      ],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "ecs" }),
    });

    // Create security groups
    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic",
    );

    // add nag suppression
    NagSuppressions.addResourceSuppressions(albSecurityGroup, [
      {
        id: "AwsSolutions-EC23",
        reason: "Allow all inbound traffic to ALB",
      },
    ]);

    const fargateSecurityGroup = new ec2.SecurityGroup(
      this,
      "FargateSecurityGroup",
      {
        vpc,
        allowAllOutbound: true,
      },
    );

    fargateSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(80),
      "Allow HTTP traffic from ALB",
    );

    // Create ECS service
    this.fargateService = new ecs.FargateService(this, "FargateService", {
      cluster,
      taskDefinition: defaultTaskDefinition,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [fargateSecurityGroup],
      enableECSManagedTags: true,
      enableExecuteCommand: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
    });

    (
      this.fargateService.node.tryFindChild("Service") as ecs.CfnService
    ).taskDefinition = props.synthOnly
      ? "dummy"
      : ssm.StringParameter.valueForStringParameter(
          this,
          constants.taskDefinitionArnSsmParamName,
        );

    // Create ALB

    const alb = new elbv2.ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Logging settings
    const logBucket = new s3.Bucket(this, "LogBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    alb.logAccessLogs(logBucket);

    const listener = alb.addListener("Listener", {
      port: 80,
    });

    listener.addTargets("ECS", {
      port: 80,
      targets: [this.fargateService],
      healthCheck: {
        path: "/",
        interval: cdk.Duration.minutes(1),
      },
    });

    // ALBのDNS名を出力
    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: alb.loadBalancerDnsName,
      description: "LoadBalancer DNS",
    });
  }
}
