/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ContextRegistryClient, ContextRegistryRequestQueryOptions, Project } from "@bentley/context-registry-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { expect } from "chai";
import { IModelHubPermission, Permission, RbacClient } from "../../RbacClient";
import { TestConfig } from "../TestConfig";

// VSTS#291161: Re-enable tests after oidc-signin-tool fixes
describe.skip("RbacClient (#integration)", () => {
  const contextRegistry = new ContextRegistryClient();
  const rbacClient = new RbacClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async function () {
    this.enableTimeouts(false);
    requestContext = await TestConfig.getAuthorizedClientRequestContext(TestUsers.super);
  });

  it("should get the permissions for any service for the specified project (#integration)", async () => {
    // Get test project
    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };

    const project: Project = await contextRegistry.getProject(requestContext, queryOptions);
    expect(!!project);

    const iModelHubServiceGPRId = 2485;
    const permissions: Permission[] = await rbacClient.getPermissions(requestContext, project.wsgId, iModelHubServiceGPRId);
    expect(permissions.length).equals(6);
  });

  it("should get the permissions relevant to iModelHub for the specified project (#integration)", async () => {
    // Get test project
    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };

    const project: Project = await contextRegistry.getProject(requestContext, queryOptions);
    expect(!!project);

    const permissions: IModelHubPermission = await rbacClient.getIModelHubPermissions(requestContext, project.wsgId);

    expect(permissions & IModelHubPermission.Create);
    expect(permissions & IModelHubPermission.Read);
    expect(permissions & IModelHubPermission.Modify);
    expect(permissions & IModelHubPermission.Delete);
    expect(permissions & IModelHubPermission.ManageResources);
    expect(permissions & IModelHubPermission.ManageVersions);
  });

});