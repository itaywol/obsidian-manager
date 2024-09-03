import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import dotenv from "dotenv";
import fastify, { FastifyInstance } from "fastify";
import { promises as fs } from "fs";
import path from "path";
import pino from "pino";

dotenv.config();

// Create a Pino logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
  },
});

// Create Fastify instance with Pino logger
const server: FastifyInstance = fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
    },
  },
});

const mainFolderPath = process.env.WORK_FOLDER;
const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

if (!mainFolderPath) {
  logger.error("WORK_FOLDER environment variable is not set");
  process.exit(1);
}

// Swagger configuration
server.register(swagger, {
  mode: "dynamic",
  hideUntagged: false,
  openapi: {
    info: {
      title: "Obsidian Manager API",
      description: "API for managing Obsidian files",
      version: "1.0.0",
    },
  },
});

server.register(swaggerUi, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
  uiHooks: {
    onRequest: function (request, reply, next) {
      next();
    },
    preHandler: function (request, reply, next) {
      next();
    },
  },
  transformSpecification(swaggerObject, request, reply) {
    return swaggerObject;
  },
  transformSpecificationClone: true,
});

// Add this function at the top level of your file
function sanitizePath(userPath: string): string {
  const normalizedPath = path
    .normalize(userPath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join("/", normalizedPath);
}

server.register(
  async function (fastify) {
    // Read file content
    interface ReadFileQuery {
      filePath: string;
    }

    const readFileSchema = {
      summary: "Read file content",
      description:
        "Reads the content of a file and returns it along with any variables found",
      tags: ["File Operations"],
      querystring: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: {
            type: "string",
            description: "Path to the file to be read",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "object",
          properties: {
            content: { type: "string", description: "Content of the file" },
            variables: {
              type: "array",
              items: { type: "string" },
              description: "List of variables found in the file",
            },
          },
        },
        500: {
          description: "Error response",
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
          },
        },
      },
    };
    fastify.get<{ Querystring: ReadFileQuery }>("/file", {
      schema: readFileSchema,
      handler: async (request, reply) => {
        const { filePath } = request.query;
        const sanitizedPath = sanitizePath(filePath);
        const fullFilePath = path.join(mainFolderPath, sanitizedPath);

        try {
          const content = await fs.readFile(fullFilePath, "utf-8");
          const variableRegex = /{{(\s*[\w.]+\s*)}}/g;
          const variables = [
            ...new Set(
              Array.from(content.matchAll(variableRegex), (m) => m[1].trim())
            ),
          ];

          return { content, variables };
        } catch (error) {
          return reply.status(500).send({ error: "Failed to read file" });
        }
      },
    });

    // Write a new file
    interface WriteFileBody {
      filePath: string;
      content?: string;
      templatePath?: string;
      append?: boolean;
      variables?: Record<string, string>;
    }

    const writeFileSchema = {
      summary: "Write or append to a file",
      description:
        "Writes content to a file, optionally using a template and variable replacement",
      tags: ["File Operations"],
      body: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: {
            type: "string",
            description: "Path to the file to be written",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
          templatePath: {
            type: "string",
            description: "Path to a template file",
          },
          append: {
            type: "boolean",
            description: "Whether to append to the file instead of overwriting",
          },
          variables: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Variables to replace in the template",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the operation was successful",
            },
            message: { type: "string", description: "Success message" },
          },
        },
        400: {
          description: "Bad request",
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
          },
        },
      },
    };

    fastify.post<{ Body: WriteFileBody }>("/file", {
      schema: writeFileSchema,
      handler: async (request, reply) => {
        const { filePath, content, templatePath, append, variables } =
          request.body;
        const sanitizedFilePath = sanitizePath(filePath);
        const fullFilePath = path.join(mainFolderPath, sanitizedFilePath);
        const isMarkdown = path.extname(fullFilePath).toLowerCase() === ".md";

        try {
          await fs.mkdir(path.dirname(fullFilePath), { recursive: true });

          if (templatePath) {
            const sanitizedTemplatePath = sanitizePath(templatePath);
            const fullTemplatePath = path.join(
              mainFolderPath,
              sanitizedTemplatePath
            );
            let templateContent = await fs.readFile(fullTemplatePath, "utf-8");

            if (variables) {
              for (const [key, value] of Object.entries(variables)) {
                const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
                templateContent = templateContent.replace(placeholder, value);
              }
            }

            if (!append) {
              await fs.writeFile(fullFilePath, templateContent);
            } else {
              await fs.appendFile(
                fullFilePath,
                isMarkdown ? `\n${templateContent}` : templateContent
              );
            }

            if (content) {
              const contentToAppend =
                isMarkdown && append ? `\n${content}` : content;
              await fs.appendFile(fullFilePath, contentToAppend);
            }
          } else if (content) {
            if (append) {
              const contentToAppend = isMarkdown ? `\n${content}` : content;
              await fs.appendFile(fullFilePath, contentToAppend);
            } else {
              await fs.writeFile(fullFilePath, content);
            }
          } else {
            return reply
              .status(400)
              .send({ error: "Either content or templatePath is required" });
          }
          return { success: true, message: "File written successfully" };
        } catch (error) {
          return reply.status(500).send({ error: "Failed to write file" });
        }
      },
    });

    // Move a file
    interface MoveFileBody {
      sourcePath: string;
      destinationPath: string;
    }

    const moveFileSchema = {
      summary: "Move a file",
      description: "Moves a file from one location to another",
      tags: ["File Operations"],
      body: {
        type: "object",
        required: ["sourcePath", "destinationPath"],
        properties: {
          sourcePath: {
            type: "string",
            description: "Path of the file to be moved",
          },
          destinationPath: {
            type: "string",
            description: "Destination path for the file",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the operation was successful",
            },
            message: { type: "string", description: "Success message" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
          },
        },
      },
    };

    fastify.put<{ Body: MoveFileBody }>("/file", {
      schema: moveFileSchema,
      handler: async (request, reply) => {
        const { sourcePath, destinationPath } = request.body;
        const sanitizedSourcePath = sanitizePath(sourcePath);
        const sanitizedDestinationPath = sanitizePath(destinationPath);
        const fullSourcePath = path.join(mainFolderPath, sanitizedSourcePath);
        const fullDestinationPath = path.join(
          mainFolderPath,
          sanitizedDestinationPath
        );

        try {
          await fs.mkdir(path.dirname(fullDestinationPath), {
            recursive: true,
          });
          await fs.rename(fullSourcePath, fullDestinationPath);
          return { success: true, message: "File moved successfully" };
        } catch (error) {
          return reply.status(500).send({ error: "Failed to move file" });
        }
      },
    });

    // Delete a file
    interface DeleteFileBody {
      filePath: string;
    }

    const deleteFileSchema = {
      summary: "Delete a file",
      description: "Deletes a file and its parent folder if it becomes empty",
      tags: ["File Operations"],
      body: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: {
            type: "string",
            description: "Path of the file to be deleted",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the operation was successful",
            },
            message: { type: "string", description: "Success message" },
          },
        },
        500: {
          description: "Server error",
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
          },
        },
      },
    };

    fastify.delete<{ Body: DeleteFileBody }>("/file", {
      schema: deleteFileSchema,
      handler: async (request, reply) => {
        const { filePath } = request.body;
        const sanitizedPath = sanitizePath(filePath);
        const fullFilePath = path.join(mainFolderPath, sanitizedPath);

        try {
          await fs.unlink(fullFilePath);
          const folderPath = path.dirname(fullFilePath);
          const folderContents = await fs.readdir(folderPath);

          if (folderContents.length === 0) {
            await fs.rmdir(folderPath);
            return {
              success: true,
              message: "File and empty folder deleted successfully",
            };
          }

          return { success: true, message: "File deleted successfully" };
        } catch (error) {
          return reply.status(500).send({ error: "Failed to delete file" });
        }
      },
    });
  },
  { prefix: "/api" }
);

const start = async () => {
  try {
    await server.listen({ host: "0.0.0.0", port });
    logger.info(
      `Swagger documentation is available at http://localhost:${port}/documentation`
    );
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
