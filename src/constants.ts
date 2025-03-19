/**
 * The name of the ECR repository
 */
export const ecrRepositoryName = "my-ecr-repo";
/**
 * The SSM parameter name indicating the task definition
 */
export const taskDefinitionArnSsmParamName =
  "/ecs-cicd-example/task-definition-arn";

/**
 * The SSM parameter name indicating the Fargate service ARN
 */
export const fargateServiceArnParamName =
  "/ecs-cicd-example/fargate-service-arn";

/**
 * The SSM parameter name indicating the ECS cluster ARN
 */
export const clusterArnParamName = "/ecs-cicd-example/cluster-arn";
