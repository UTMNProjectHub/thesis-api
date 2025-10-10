import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import jwt from "jsonwebtoken";
import path from "path";

const PROTO_PATH = path.join(__dirname, "../../proto/auth.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth as any;

const validateToken = (call: any, callback: any) => {
  const { token } = call.request;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    callback(null, { valid: true, user_id: decoded.sub });
  } catch (error) {
    callback(null, { valid: false, user_id: "" });
  }
};

const server = new grpc.Server();
server.addService(authProto.AuthService.service, {
  ValidateToken: validateToken,
});

server.bindAsync(
  `0.0.0.0:${process.env.RPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      console.error(error);
      return;
    }
    console.log(`gRPC server running at http://0.0.0.0:${port}`);
  },
);
