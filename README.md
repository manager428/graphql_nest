Repo for Appsync custom resolves

## Notes:

need to have the CDK CLI installed

`yarn global upgrade aws-cdk@latest`

Must configure `~/.aws/credentials` and `~/.aws/config` with a `user1` profile to deploy directly from the repo to dev.
Shouldnt need to do this once CI/CD is setup

To deploy locally you should have Docker installed. https://www.docker.com/products/docker-desktop/

To deploy you may need to use `npm run deploy` or `npm run cdk:bootstrap` then npm run deploy

## confirm pw command:

`aws cognito-idp admin-set-user-password --user-pool-id us-west-2_bpkbPxEZ0 --username will@sirge.io --password <Password> --permanent`

## When porting legacy api's over to new Appsync resolvers, make sure to follow these steps end to end:

1. Review the code from the previous legacy PHP api route to outline the business logic and expected behavior
2. In the sirge-appsync-api repo, create a new file in the lambda-handlers folder to represent the graphql resolver you are porting from the previous REST endpoint
3. Add that definition to the lib/config.lambda.ts
4. Implements the resolver locally
5. Define your typescript types, this includes any data models/entities along with graphql input/request and output/response types
   5.a If this is a shared type you will need to put it into the sirge-util shared package repo and publish it
6. Make sure you define your mutation or query within the schema.graphql, currently I am seeing a few missing
7. deploy our code to your own appsync environment, run your code through graph ql and look at the event data in cloud watch. Also take a look at the reponse from the graphql in appsync console to make sure there are no validation errors. Capture what you need to create an test event locally
8. Configure our local test event so you can also debug locally
9. Create your test harness for your resolver, your tests should include both postive and negative outcomes
10. Make sure everything is running in these 3 environments. Jest tests, pushed and deployed to your AWS Appsync environment, and through local debugging
11. Once everything had been completed and verified by you as the dev, now you can open your PR
