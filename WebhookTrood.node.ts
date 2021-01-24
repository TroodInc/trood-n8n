import { BINARY_ENCODING, IWebhookFunctions } from "n8n-core";

import {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
} from "n8n-workflow";

import { Response } from "express";
import { TroodABACResolver } from "./TroodABACEngine.node";
import { IncomingHttpHeaders } from "http";
import * as fs from "fs";
import * as formidable from "formidable";
import * as crypto from "crypto";

interface TroodAuth {
  type: string;
  service_domain: string;
  service_auth_secret: string;
}

function getServiceToken(): string {
  const domain: string = process.env["SERVICE_DOMAIN"]!;
  const domainBuf = Buffer.from(domain);

  const secret: string = process.env["SERVICE_AUTH_SECRET"]!;
  const troodSign = "trood.signer";
  const signBuf = Buffer.from(troodSign);

  const key = crypto
    .createHash("sha1")
    .update(signBuf + secret)
    .digest();
  let signature = crypto
    .createHmac("sha1", key)
    .update(domainBuf)
    .digest("base64");

  signature = signature.slice(0, -1);

  return "Service " + domain + ":" + signature;
}

function parseTroodAuth(authHeader: string): TroodAuth {
  return {
    type: authHeader?.split(" ")[0],
    service_domain: authHeader?.split(" ")[1].split(":")[0],
    service_auth_secret: authHeader?.split(" ")[1].split(":")[1],
  };
}

function authorizationError(
  resp: Response,
  realm: string,
  responseCode: number,
  message?: string
) {
  if (message === undefined) {
    message = "Authorization problem!";
    if (responseCode === 401) {
      message = "Authorization is required!";
    } else if (responseCode === 403) {
      message = "Authorization data is wrong!";
    }
  }
  resp.writeHead(responseCode, {
    "WWW-Authenticate": `Basic realm="${realm}"`,
  });
  return {
    noWebhookResponse: true,
  };
}

export class WebhookTrood implements INodeType {
  description: INodeTypeDescription = {
    displayName: "WebhookTRood",
    name: "webhookTrood",
    group: ["trigger"],
    version: 1,
    description: "Starts the workflow when a webhook got called.",
    defaults: {
      name: "WebhookTrood",
      color: "#885577",
    },
    inputs: [],
    outputs: ["main"],
    webhooks: [
      {
        name: "default",
        httpMethod: '={{$parameter["httpMethod"]}}',
        isFullPath: true,
        responseCode: '={{$parameter["responseCode"]}}',
        responseMode: '={{$parameter["responseMode"]}}',
        responseData: '={{$parameter["responseData"]}}',
        responseBinaryPropertyName:
          '={{$parameter["responseBinaryPropertyName"]}}',

        ContentType: '={{$parameter["options"]["responseContentType"]}}',
        responsePropertyName:
          '={{$parameter["options"]["responsePropertyName"]}}',
        responseHeaders: '={{$parameter["options"]["responseHeaders"]}}',
        path: '={{$parameter["path"]}}',
      },
    ],
    properties: [
      {
        displayName: "HTTP Method",
        name: "httpMethod",
        type: "options",
        options: [
          {
            name: "GET",
            value: "GET",
          },
          {
            name: "POST",
            value: "POST",
          },
        ],
        default: "GET",
        description: "The HTTP method to liste to.",
      },
      {
        displayName: "Path",
        name: "path",
        type: "string",
        default: "",
        placeholder: "webhook",
        required: true,
        description: "The path to listen to.",
      },
      {
        displayName: "Response Code",
        name: "responseCode",
        type: "number",
        typeOptions: {
          minValue: 100,
          maxValue: 599,
        },
        default: 200,
        description: "The HTTP Response code to return",
      },
      {
        displayName: "Response Mode",
        name: "responseMode",
        type: "options",
        options: [
          {
            name: "On Received",
            value: "onReceived",
            description: "Returns directly with defined Response Code",
          },
          {
            name: "Last Node",
            value: "lastNode",
            description: "Returns data of the last executed node",
          },
        ],
        default: "onReceived",
        description: "When and how to respond to the webhook.",
      },
      {
        displayName: "Response Data",
        name: "responseData",
        type: "options",
        displayOptions: {
          show: {
            responseMode: ["lastNode"],
          },
        },
        options: [
          {
            name: "All Entries",
            value: "allEntries",
            description:
              "Returns all the entries of the last node. Always returns an array.",
          },
          {
            name: "First Entry JSON",
            value: "firstEntryJson",
            description:
              "Returns the JSON data of the first entry of the last node. Always returns a JSON object.",
          },
          {
            name: "First Entry Binary",
            value: "firstEntryBinary",
            description:
              "Returns the binary data of the first entry of the last node. Always returns a binary file.",
          },
        ],
        default: "firstEntryJson",
        description:
          "What data should be returned. If it should return<br />all the itemsas array or only the first item as object.",
      },
      {
        displayName: "Property Name",
        name: "responseBinaryPropertyName",
        type: "string",
        required: true,
        default: "data",
        displayOptions: {
          show: {
            responseData: ["firstEntryBinary"],
          },
        },
        description: "Name of the binary property to return",
      },
      {
        displayName: "Options",
        name: "options",
        type: "collection",
        placeholder: "Add Option",
        default: {},
        options: [
          {
            displayName: "Binary Data",
            name: "binaryData",
            type: "boolean",
            displayOptions: {
              show: {
                "/httpMethod": ["POST"],
              },
            },
            default: false,
            description: "Set to true if webhook will receive binary data.",
          },
          {
            displayName: "Binary Property",
            name: "binaryPropertyName",
            type: "string",
            default: "data",
            required: true,
            displayOptions: {
              show: {
                binaryData: [true],
              },
            },
            description: `Name of the binary property to which to write the data of<br />
									the received file. If the data gets received via "Form-Data Multipart"<br />
									it will be the prefix and a number starting with 0 will be attached to it.`,
          },
          {
            displayName: "Response Content-Type",
            name: "responseContentType",
            type: "string",
            displayOptions: {
              show: {
                "/responseData": ["firstEntryJson"],
                "/responseMode": ["lastNode"],
              },
            },
            default: "",
            placeholder: "application/xml",
            description:
              'Set a custom content-type to return if another one as the "application/json" should be returned.',
          },
          {
            displayName: "Response Headers",
            name: "responseHeaders",
            placeholder: "Add Response Header",
            description: "Add headers to the webhook response.",
            type: "fixedCollection",
            typeOptions: {
              multipleValues: true,
            },
            default: {},
            options: [
              {
                name: "entries",
                displayName: "Entries",
                values: [
                  {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    description: "Name of the header.",
                  },
                  {
                    displayName: "Value",
                    name: "value",
                    type: "string",
                    default: "",
                    description: "Value of the header.",
                  },
                ],
              },
            ],
          },
          {
            displayName: "Property Name",
            name: "responsePropertyName",
            type: "string",
            displayOptions: {
              show: {
                "/responseData": ["firstEntryJson"],
                "/responseMode": ["lastNode"],
              },
            },
            default: "data",
            description:
              "Name of the property to return the data of instead of the whole JSON.",
          },
          {
            displayName: "Raw Body",
            name: "rawBody",
            type: "boolean",
            displayOptions: {
              hide: {
                binaryData: [true],
              },
            },
            default: false,
            description: "Raw body (binary)",
          },
        ],
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const options = this.getNodeParameter("options", {}) as IDataObject;
    const req = this.getRequestObject();
    const resp = this.getResponseObject();
    const headers = this.getHeaderData();
    const realm = "Webhook";

    const authInfo: string = (headers as IncomingHttpHeaders).authorization!;
    if (authInfo === undefined) {
      authorizationError(resp, realm, 401);
    }

    const authObj = parseTroodAuth(authInfo);
    const opt = {
      method: "POST",
      url: process.env["TROOD_AUTH_SERVICE_URL"] + "/api/v1.0/verify-token/",
      headers: {
        Authorization: getServiceToken(),
      },
      formData: {
        type: authObj.type,
        token: authObj.service_domain + authObj.service_auth_secret,
      },
    };

    try {
      const serviceInfo = await this.helpers.request(opt);
      const info = JSON.parse(serviceInfo);
      const abacResolver = new TroodABACResolver(
        info.user,
        info.abac[process.env["SERVICE_DOMAIN"]!],
        info.abac,
        "allow"
      );

      const rule = abacResolver.Check(
        process.env["SERVICE_DOMAIN"]!,
        "data_POST"
      );

      if (!rule.passed) {
        authorizationError(resp, realm, 403);
      }
    } catch (e) {
      authorizationError(resp, realm, 500, e);
    }

    // @ts-ignore
    const mimeType = headers["content-type"] || "application/json";
    if (mimeType.includes("multipart/form-data")) {
      const form = new formidable.IncomingForm();
      return new Promise((resolve, reject) => {
        form.parse(req, async (err, data, files) => {
          const returnItem: INodeExecutionData = {
            binary: {},
            json: {
              body: data,
              headers,
              query: this.getQueryData(),
            },
          };

          let count = 0;
          for (const file of Object.keys(files)) {
            let binaryPropertyName = file;
            if (options.binaryPropertyName) {
              binaryPropertyName = `${options.binaryPropertyName}${count}`;
            }

            const fileJson = files[file].toJSON() as IDataObject;
            const fileContent = await fs.promises.readFile(files[file].path);

            returnItem.binary![
              binaryPropertyName
            ] = await this.helpers.prepareBinaryData(
              Buffer.from(fileContent),
              fileJson.name as string,
              fileJson.type as string
            );

            count += 1;
          }
          resolve({
            workflowData: [[returnItem]],
          });
        });
      });
    }

    if (options.binaryData === true) {
      return new Promise((resolve, reject) => {
        const binaryPropertyName = options.binaryPropertyName || "data";
        const data: Buffer[] = [];

        req.on("data", (chunk) => {
          data.push(chunk);
        });

        req.on("end", async () => {
          const returnItem: INodeExecutionData = {
            binary: {},
            json: {
              body: this.getBodyData(),
              headers,
              query: this.getQueryData(),
            },
          };

          returnItem.binary![
            binaryPropertyName as string
          ] = await this.helpers.prepareBinaryData(Buffer.concat(data));

          return resolve({
            workflowData: [[returnItem]],
          });
        });

        req.on("error", (err) => {
          throw new Error(err.message);
        });
      });
    }

    const response: INodeExecutionData = {
      json: {
        body: this.getBodyData(),
        headers,
        query: this.getQueryData(),
      },
    };

    if (options.rawBody) {
      response.binary = {
        data: {
          // @ts-ignore
          data: req.rawBody.toString(BINARY_ENCODING),
          mimeType,
        },
      };
    }

    return {
      workflowData: [[response]],
    };
  }
}
