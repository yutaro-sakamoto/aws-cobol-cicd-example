import { AwsCdkTypeScriptApp } from '@yutaro-sakamoto/projen-cdk';
import { YamlFile } from 'projen';

const project = new AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  devDeps: ['@yutaro-sakamoto/projen-cdk@v0.0.13'],
  name: 'aws-cobol-cicd-example',
  projenrcTs: true,
  license: 'MIT',
  copyrightOwner: 'Yutaro Sakamoto',
  copyrightPeriod: '2025',

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

project.addDeps('dotenv');
project.addDeps('cdk-nag');
project.gitignore.addPatterns('.env');


// Deploy to AWS
new YamlFile(project, '.github/workflows/push-dev.yml', {
  obj: {
    name: 'push',
    on: {
      push: {
        branches: ['dev'],
      },
    },
    concurrency: {
      'group': '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    permissions: {
      contents: 'read',
    },
    jobs: {
      'check-workflows': {
        permissions: {
          contents: 'read',
        },
        uses: './.github/workflows/check-workflows.yml',
      },
      'deploy': {
        needs: 'check-workflows',
        permissions: {
          'contents': 'read',
          'id-token': 'write',
        },
        secrets: 'inherit',
        uses: './.github/workflows/deploy.yml',
        with: {
          environment: 'dev',
        },
      },
    },
  },
});


project.tryRemoveFile('.github/workflows/check-workflows.yml');
new YamlFile(project, '.github/workflows/check-workflows.yml', {
  obj: {
    name: 'Check workflow files',
    on: 'workflow_call',
    permissions: {
      contents: 'read',
    },
    jobs: {
      build: {
        'runs-on': 'ubuntu-latest',
        'steps': [
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Install actionlint',
            run: 'GOBIN=$(pwd) go install github.com/rhysd/actionlint/cmd/actionlint@latest',
          },
          {
            name: 'Run actionlint',
            run: 'find .github/workflows -name "*.yml" ! -name "upgrade.yml" ! -name "build.yml" ! -name "pull-request-lint.yml" -print0 | xargs -0 ./actionlint',
          },
        ],
      },
    },
  },
});

project.tryRemoveFile('.github/workflows/push.yml');
new YamlFile(project, '.github/workflows/push.yml', {
  obj: {
    name: 'push',
    on: {
      push: {
        'branches-ignore': ['dev'],
      },
    },
    concurrency: {
      'group': '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    permissions: {
      'contents': 'read',
      'id-token': 'write',
    },
    jobs: {
      'check-workflows': {
        permissions: {
          contents: 'read',
        },
        uses: './.github/workflows/check-workflows.yml',
      },
      'test': {
        needs: 'check-workflows',
        permissions: {
          'contents': 'read',
          'id-token': 'write',
        },
        secrets: 'inherit',
        uses: './.github/workflows/test.yml',
        with: {
          environment: 'dev',
        },
      },
    },
  },
});

// Deploy to AWS
new YamlFile(project, '.github/workflows/deploy.yml', {
  obj: {
    name: 'deploy',
    on: {
      workflow_call: {
        inputs: {
          environment: {
            type: 'string',
            required: true,
            description: 'Environment to deploy to',
          },
        },
      },
    },
    permissions: {
      'contents': 'read',
      'id-token': 'write',
    },
    jobs: {
      deploy: {
        'runs-on': 'ubuntu-latest',
        'environment': '${{ inputs.environment }}',
        'steps': [
          {
            uses: 'aws-actions/configure-aws-credentials@v4',
            with: {
              'role-to-assume': 'arn:aws:iam::${{ secrets.AWS_ID }}:role/${{ secrets.ROLE_NAME }}',
              'role-session-name': 'gh-oidc-${{ github.run_id }}-${{ github.run_attempt }}',
              'aws-region': '${{ secrets.AWS_REGION }}',
            },
          },
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Setup .npmrc',
            run:
              'echo \'@yutaro-sakamoto:registry=https://npm.pkg.github.com\' >> ~/.npmrc && ' +
              'echo \'//npm.pkg.github.com/:_authToken=${{ secrets.GH_PACKAGES_TOKEN }}\' >> ~/.npmrc',
          },
          {
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '22',
              'cache': 'yarn',
              'cache-dependency-path': 'yarn.lock',
            },
          },
          {
            run: 'yarn install',
          },
          {
            name: 'Set environment variables',
            run: `
              echo CDK_DEFAULT_REGION="\${{ secrets.AWS_REGION }}" >> "$GITHUB_ENV" &&
              echo CDK_DEFAULT_ACCOUNT="\${{ secrets.AWS_ID }}" >> "$GITHUB_ENV" &&
              echo AWS_CODECONNECTIONS_ARN="\${{ secrets.AWS_CODECONNECTIONS_ARN }}" >> "$GITHUB_ENV"
            `,
          },
          {
            name: 'Deploy Application Stack',
            run: 'npx cdk deploy --require-approval never --outputs-file cdk-outputs.json aws-cobol-cicd-example-dev',
          },
          {
            name: 'Start pipeline execution',
            run: 'aws codepipeline start-pipeline-execution --name "$(jq -r \'."aws-cobol-cicd-example-dev".applicationPipelineName\' cdk-outputs.json)" --region "$CDK_DEFAULT_REGION"',
          },
          {
            name: 'Deploy Infrastructure Stack',
            run: 'npx cdk deploy --require-approval never --outputs-file cdk-outputs.json aws-cobol-cicd-example-dev-infrastructures',
          },
        ],
      },
    },
  },
});

project.tryRemoveFile('.github/workflows/test.yml');
// Deploy to AWS
new YamlFile(project, '.github/workflows/test.yml', {
  obj: {
    name: 'test',
    permissions: {
      'contents': 'read',
      'id-token': 'write',
    },
    on: {
      workflow_call: {
        inputs: {
          environment: {
            type: 'string',
            required: false,
            default: 'dev',
            description: 'Environment to deploy to',
          },
        },
      },
    },
    env: {
      CDK_DEFAULT_ACCOUNT: 'example-account',
      CDK_DEFAULT_REGION: 'ap-northeast-1',
      CDK_SYNTH_ONLY: 'true',
    },
    jobs: {
      test: {
        'runs-on': 'ubuntu-latest',
        'environment': '${{ inputs.environment }}',
        'steps': [
          {
            uses: 'aws-actions/configure-aws-credentials@v4',
            with: {
              'role-to-assume': 'arn:aws:iam::${{ secrets.AWS_ID }}:role/${{ secrets.ROLE_NAME }}',
              'role-session-name': 'gh-oidc-${{ github.run_id }}-${{ github.run_attempt }}',
              'aws-region': '${{ secrets.AWS_REGION }}',
            },
          },
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Setup .npmrc',
            run:
              'echo \'@yutaro-sakamoto:registry=https://npm.pkg.github.com\' >> ~/.npmrc && ' +
              'echo \'//npm.pkg.github.com/:_authToken=${{ secrets.GH_PACKAGES_TOKEN }}\' >> ~/.npmrc',
          },
          {
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '22',
              'cache': 'yarn',
              'cache-dependency-path': 'yarn.lock',
            },
          },
          {
            run: 'yarn install',
          },
          {
            name: 'Check format by Prettier',
            run: 'npx prettier src --check',
          },
          {
            name: 'Check by ESLint',
            run: 'yarn eslint',
          },
          {
            name: 'Tests',
            run: 'yarn test',
          },
          {
            name: 'Check docs',
            run: 'npx typedoc --validation src/*.ts',
          },
        ],
      },
    },
  },
});


project.synth();