# Obsidian Manager API

Obsidian Manager API is a service that provides file management operations for Obsidian vaults through a RESTful API. It allows reading, writing, moving, and deleting files within a specified work folder.

## Features

- Read file content and extract variables
- Write or append to files, with optional template and variable replacement
- Move files
- Delete files and empty parent folders
- Swagger UI for API documentation and testing

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/your-username/obsidian-manager.git
   cd obsidian-manager
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Configuration

Create a `.env` file in the project root with the following content:

```
PORT=3000
WORK_FOLDER=/path/to/your/obsidian/vault
```

Adjust the `PORT` and `WORK_FOLDER` values as needed.

## Development

To run the service in development mode with hot reloading:

```
npm run dev
```

## Building

To compile the TypeScript code to JavaScript:

```
npm run build
```

## Running

To start the service in production mode:

```
npm start
```

## Testing

To run the test suite:

```
npm test
```

For test coverage:

```
npm run test:coverage
```

## Docker

To build and run the service using Docker:

1. Build the Docker image:

   ```
   docker build -t obsidian-manager .
   ```

2. Run the container:
   ```
   docker run -p 3000:3000 -v /path/to/your/obsidian/vault:/app/data -e WORK_FOLDER=/app/data obsidian-manager
   ```

Replace `/path/to/your/obsidian/vault` with the actual path to your Obsidian vault.

## API Documentation

Once the service is running, you can access the Swagger UI documentation at:

```
http://localhost:3000/documentation
```

This provides an interactive interface to explore and test the API endpoints.

## API Endpoints

- `GET /api/file`: Read file content
- `POST /api/file`: Write or append to a file
- `PUT /api/file`: Move a file
- `DELETE /api/file`: Delete a file

For detailed information on request/response formats, refer to the Swagger documentation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
