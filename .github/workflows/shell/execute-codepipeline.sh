#!/bin/bash

AWS_REGION=$1
PIPELINE_NAME=$2

echo "Start the pipeline execution..."
EXECUTION_ID=$(aws codepipeline start-pipeline-execution --query 'pipelineExecutionId' --output text --name "$PIPELINE_NAME" --region "$AWS_REGION")
echo "Pipeline ID: $EXECUTION_ID"

echo "パイプライン実行の完了を待機中..."

while true; do
  # Get the current status of the pipeline execution
  STATUS=$(aws codepipeline get-pipeline-execution \
    --pipeline-name "$PIPELINE_NAME" \
    --pipeline-execution-id "$EXECUTION_ID" \
    --query 'pipelineExecution.status' \
    --output text)
  
  echo "Current pipeline status: $STATUS"
  
  # Check if the pipeline execution has completed
  if [ "$STATUS" == "Succeeded" ]; then
    echo "Pipeline execution succeeded."
    exit 0
  elif [ "$STATUS" == "Failed" ] || [ "$STATUS" == "Stopped" ]; then
    echo "Pipeline execution failed or stopped."
    exit 1
  fi
  
  # If the pipeline execution is still in progress, wait for a while before checking again
  echo "Wating..."
  sleep 5
done