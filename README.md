# Core Entitlements Full Node

This project is a package created with an interface for interacting directly with the Entitlements table structure in a DynamoDB database.

# Requirements: 

NodeJS 6.x+ 

The core-entitlements-node package requires the Node 6.10 runtime environment. 

# DynamoDB

This package accepts a tableName option that will be used as the `entitlement` table. The table must already be running in the current AWS account before running.

To make it easy, we've included a terraform configuration and init scripts to this package. To use it, you can clone this project, copy the terraform directory to your project and run the script.

    $ git clone git@github.nike.com:ngp/core-entitlements-full-node.git
    $ mkdir your-entitlements-project/terraform && cp core-entitlements-full-node/terraform/* your-entitlements-project/terraform/
    $ cd your-entitlements-project/terraform
    $ ./init.sh <environment> <table_name>
        
This will create a folder in the current `terraform` directory named after the specified <environment> (dev, prod, test) and a few files. You can create multiple environments using this script.

    - terraform
        - dev
            + dynamo.tf
            + dev.tf
            + init.sh
            + variables.tf
    
Notice that your table name gets injected into `variables.tf` which will be referenced by your table configuration in `dynamo.tf`.
This configuration will create a DynamoDB table with the naming convention `<table_name>_<environment>` (Entitlements_Prod). 
If you need to change your table name after initializing this script, do so in the `variables.tf`. You can also increase or decrease
the read/write capacity for these tables in the `dynamo.tf`.

To deploy the table to your AWS account, cd to the environment directory, run terraform and you're done.

    $ cd <environment dir>
    $ terraform apply

# Usage

### Configuration  
The package requires a table name and the AWS DynamoDB DocumentClient to be provided as options.

    let AWS = require('aws-sdk')
    
    AWS.config.update({
        region: 'us-west-2'
    })
    
    let entitlements = require('@nike/core-entitlements-node')({
        tableName: 'entitlements',
        documentClient: new AWS.DynamoDB.DocumentClient()
    })

### Get Permissions
The package provides two options for checking permissions for a JWT. You can either pass in a list of resources with the actions 
that need to be checked or you can provide a list of resources without actions and the actions will be populated for you to compare.

#### Get Actions Example

    let resource1 = {
         namespace: 'cool-shoes',
         id: {
             id_attr1: 'id-attr1-value',
             id_attr2: 'id-attr2-value'
         }
     }
     
    let resource2 = {
         namespace: 'cool-shirts',
         id: {
             id_attr1: 'id-attr1-value',
             id_attr2: 'id-attr2-value'
         }
     }
     
    # Get a list of actions for a list of resources 
    entitlements.getActionsForResources([resource1, resource2], jwtToken)
    

#### Response

    [
        {
            resource: { ... },
            actionsAllowed: [
                'READ',
                'WRITE'
            ]
        },
        {
            resource: { ... },
            actionsAllowed: [
                'UPDATE'
            ]
        }
    ]
    
#### Get Permissions For Actions Example
    
    let resource1 = {
        resource: {
            namespace: "shirts",
            id: {
                id_attr5: "foo",
                id_attr6: "bar"
            }
        },
        actions: [
            'READ',
            'WRITE',
            'UPDATE'
        ]
    }
     
    let resource2 =  {
        resource: {
            namespace: "shoes",
            id: {
                id_attr3: "foo",
                id_attr4: "bar"
            }
        },
        actions: [
            'READ',
            'WRITE'
        ]
    }
     
    # Get a list of actions for a list of resources 
    entitlements.getPermissionsForResourcesAndActions([resource1, resource2], jwtToken)
    
#### Response
    
    [
        {
            resources: { ... },
            actions: [
                'READ',
                'WRITE'
            ],
            allowed: true
        },
        {
            resources: { ... },
            actions: [
                'READ',
                'WRITE'
            ],
            allowed: false
        },
    ]
    
# API

The package exposes some basic CRUD methods as well as permission checks.

### createResourceEntitlement(entitlement)
Creates the provided entitlement using the resource as the hash key.

### updateResourceEntitlement(entitlement)
Updates the provided entitlement using the resource as the hash key.

### deleteResourceEntitlement(resource)
Deletes an entitlement by the provided resource.

### getActionsForResources(resourceList, jwtToken)
Returns a list of actions mapped to the corresponding resource. List is returned in the same order as the resources are provided.

### getPermissionsForResourcesAndActions(resourceActionList, jwtToken)
Returns a permission value mapped to the corresponding resource and action. List is returned in the same order as the resources are provided.

### Entitlement
An entitlement definition contains a version, resource and a list of statements.

    # Example entitlement.
    {
      version: "4.6.2",
      resource: {
        namespace: "product",
        id: {
          id_attr1 : "foo",
          id_attr2 : "bar"
        }
      },
      statements : [
        {
          time: {
            start : "2017-03-23T18:22:22Z",
            end : "2017-09-23T18:22:22Z"
          },
          principal: {
            oauth2 : {
              scopes : [ "product.shoes.write"],
              claims : {
                department : "Shoe Science",
                groups : ["master_list_updators", "superusers"]
              }
            }
          },
          actionsAllowed : ["WRITE"]
        },
        {
          actionsAllowed : ["READ"]
        }
      ]
    }
    
### Resource
A Resource is a unique definition for a set of statements.

      resource: {
        namespace: "product",
        id: {
          id_attr1 : "foo",
          id_attr2 : "bar"
        }
      }
      
### Statement
A Statement defines the actions allowed for a authenticated user with the provided oauth2 configuration. 
When a statement is provided without any principal or oauth2 value the actions are applied to all.

    statements : [
        {
          time: {
            start : "2017-03-23T18:22:22Z",
            end : "2017-09-23T18:22:22Z"
          },
          principal: {
            oauth2 : {
              scopes : [ "product.shoes.write"],
              claims : {
                department : "Shoe Science",
                groups : ["master_list_updators", "superusers"]
              }
            }
          },
          actionsAllowed : ["WRITE"]
        },
        {
          actionsAllowed : ["READ"]
        }
    ]

### Actions
Actions are defined as a permission action that the associated statement principal can perform.

    actions: [
        'READ',
        'WRITE'
    ]
    
There is also a REST API running in AWS Lambda that consumes this package and exposes it's methods through http. To see that project 
in the Nike Developer Portal click [here](https://developer.niketech.com/docs/projects/Lambda%20Entitlements%20Node). To see the source
view it in the Nike Enterprise Github repository [here](https://github.nike.com/ngp/lambda-entitlements-node).

To view this documentation in the Nike Developer Portal click [here](https://developer.niketech.com/docs/projects/Core%20Entitlements%20Node)
# lambda-router
