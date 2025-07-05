import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { createBasicLambdaRole, getCommonLambdaSettings, stageName } from './config';

export interface RouteArgs {
  path: string;
  method?: string;
  eventHandler?: aws.lambda.Function;
  authorizers?: {
    authType: string;
    authorizerName: string;
    parameterName: string;
    identityValidationExpression: string;
    type: string;
    handler?: aws.lambda.Function;
    authorizerResultTtlInSeconds?: number;
    parameterLocation?: string;
  }[];
  iamAuthEnabled?: boolean;
  apiKeyRequired?: boolean;
}
export function createRESTAPI(routes: RouteArgs[]) {
  // Create API Gateway
  const api = new aws.apigateway.RestApi('api', {
    name: 'api',
    binaryMediaTypes: ['audio/mpeg'],
  });

  // Create a CORS handler for OPTIONS requests
  const corsHandler = new aws.lambda.Function(`${stageName}-corsHandler`, {
    ...getCommonLambdaSettings('corsHandler'),
    code: new pulumi.asset.AssetArchive({
      '.': new pulumi.asset.FileArchive('../dist/functions/cors'),
    }),
    handler: 'index.handler',
  });

  // Store authorizers by name
  const authorizers: { [name: string]: aws.apigateway.Authorizer } = {};

  // Process routes based on environment
  const updatedRoutes = routes.map((route): RouteArgs => {
    if (stageName === 'dev') {
      const { authorizers, ...rest } = route;
      return rest;
    }
    return route;
  });

  // Create resources, methods, and integrations for each route
  const resources: { [path: string]: aws.apigateway.Resource } = {};
  const deploymentDependencies: pulumi.Resource[] = [];

  // Helper function to get or create a resource for a path
  const getOrCreateResource = (path: string): aws.apigateway.Resource => {
    if (resources[path]) {
      return resources[path];
    }

    // Remove leading slash if present
    const pathPart = path.startsWith('/') ? path.substring(1) : path;

    // For root path, return the root resource
    if (pathPart === '' || pathPart === '/') {
      return { id: api.rootResourceId } as aws.apigateway.Resource;
    }

    // Split path into segments
    const segments = pathPart.split('/');
    let parentId = api.rootResourceId;
    let currentPath = '';

    // Create resources for each segment
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!resources[currentPath]) {
        resources[currentPath] = new aws.apigateway.Resource(
          `resource-${currentPath.replace(/\//g, '-')}`,
          {
            restApi: api.id,
            parentId,
            pathPart: segment,
          }
        );
      }

      parentId = resources[currentPath].id;
    }

    return resources[pathPart];
  };

  // Track created OPTIONS methods to avoid duplicates
  const createdOptionsMethods: { [path: string]: boolean } = {};

  // Process each route
  for (const route of updatedRoutes) {
    const resource = getOrCreateResource(route.path);

    if (route.eventHandler) {
      // Create authorizer if needed
      let authorizerId: pulumi.Input<string> | undefined;
      let authorizationType = route.iamAuthEnabled ? 'AWS_IAM' : 'NONE';

      if (route.authorizers && route.authorizers.length > 0 && stageName !== 'dev') {
        const authConfig = route.authorizers[0]; // Use the first authorizer

        // Check if the authorizer has a handler
        if (authConfig.handler) {
          // Create the authorizer if it doesn't exist yet
          if (!authorizers[authConfig.authorizerName]) {
            authorizers[authConfig.authorizerName] = new aws.apigateway.Authorizer(
              `authorizer-${authConfig.authorizerName}`,
              {
                restApi: api.id,
                name: authConfig.authorizerName,
                type: authConfig.type,
                identitySource: `method.request.header.${authConfig.parameterName}`,
                identityValidationExpression: authConfig.identityValidationExpression,
                authorizerResultTtlInSeconds: authConfig.authorizerResultTtlInSeconds || 300,
                authorizerUri: authConfig.handler.invokeArn,
              }
            );

            // Grant API Gateway permission to invoke the authorizer
            new aws.lambda.Permission(`permission-authorizer-${authConfig.authorizerName}`, {
              action: 'lambda:InvokeFunction',
              function: authConfig.handler.name,
              principal: 'apigateway.amazonaws.com',
              sourceArn: pulumi.interpolate`${api.executionArn}/*`,
            });
          }

          authorizerId = authorizers[authConfig.authorizerName].id;
          authorizationType = authConfig.authType;
        }
      }

      // Create method
      const method = new aws.apigateway.Method(
        `method-${route.path.replace(/\//g, '-')}-${route.method}`,
        {
          restApi: api.id,
          resourceId: resource.id,
          httpMethod: route.method || 'GET',
          authorization: authorizationType,
          authorizerId: authorizerId,
          apiKeyRequired: route.apiKeyRequired || false,
        }
      );
      deploymentDependencies.push(method);

      // Create integration
      const integration = new aws.apigateway.Integration(
        `integration-${route.path.replace(/\//g, '-')}-${route.method}`,
        {
          restApi: api.id,
          resourceId: resource.id,
          httpMethod: method.httpMethod,
          integrationHttpMethod: 'POST',
          type: 'AWS_PROXY',
          uri: route.eventHandler.invokeArn,
        }
      );
      deploymentDependencies.push(integration);

      // Create Lambda permission
      const lambdaPermission = new aws.lambda.Permission(
        `permission-${route.path
          .replace(/\//g, '-')
          .replace(/[{}]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')}-${route.method}`,
        {
          action: 'lambda:InvokeFunction',
          function: route.eventHandler.name,
          principal: 'apigateway.amazonaws.com',
          sourceArn: pulumi.interpolate`${api.executionArn}/*/${method.httpMethod}${route.path}`,
        }
      );
      deploymentDependencies.push(lambdaPermission);

      // Only create OPTIONS method and permission if not already created for this path
      if (!createdOptionsMethods[route.path]) {
        createdOptionsMethods[route.path] = true;

        // Add OPTIONS method for CORS if not already present
        const optionsMethod = new aws.apigateway.Method(
          `method-${route.path.replace(/\//g, '-')}-OPTIONS`,
          {
            restApi: api.id,
            resourceId: resource.id,
            httpMethod: 'OPTIONS',
            authorization: 'NONE',
          }
        );
        deploymentDependencies.push(optionsMethod);

        // Create integration for OPTIONS
        const optionsIntegration = new aws.apigateway.Integration(
          `integration-${route.path.replace(/\//g, '-')}-OPTIONS`,
          {
            restApi: api.id,
            resourceId: resource.id,
            httpMethod: optionsMethod.httpMethod,
            integrationHttpMethod: 'POST',
            type: 'AWS_PROXY',
            uri: corsHandler.invokeArn,
          }
        );
        deploymentDependencies.push(optionsIntegration);

        // Create Lambda permission for OPTIONS
        const optionsLambdaPermission = new aws.lambda.Permission(
          `permission-${route.path
            .replace(/\//g, '-')
            .replace(/[{}]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')}-OPTIONS`,
          {
            action: 'lambda:InvokeFunction',
            function: corsHandler.name,
            principal: 'apigateway.amazonaws.com',
            sourceArn: pulumi.interpolate`${api.executionArn}/*/OPTIONS${route.path}`,
          }
        );
        deploymentDependencies.push(optionsLambdaPermission);
      }
    }
  }

  // Create deployment
  const deployment = new aws.apigateway.Deployment(
    `${stageName}-deployment`,
    {
      restApi: api.id,
      triggers: {
        redeployment: pulumi.interpolate`${Date.now()}`,
      },
    },
    { dependsOn: deploymentDependencies }
  );

  // Create stage
  const stage = new aws.apigateway.Stage(`${stageName}-stage`, {
    deployment: deployment.id,
    restApi: api.id,
    stageName: stageName,
    xrayTracingEnabled: true,
  });

  return {
    api,
    url: pulumi.interpolate`${api.executionArn}${stage.stageName}`,
    stage,
  };
}
