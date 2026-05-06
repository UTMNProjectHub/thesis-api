import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import jwt from "jsonwebtoken";

const PROTO_PATH = path.join(__dirname, "../../proto/auth.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
});

// biome-ignore lint/suspicious/noExplicitAny: grpc package definition is untyped
const authProto = grpc.loadPackageDefinition(packageDefinition).auth as any;

// biome-ignore lint/suspicious/noExplicitAny: grpc call/callback types are untyped
const validateToken = (call: any, callback: any) => {
	const { token } = call.request;

	try {
		// biome-ignore lint/suspicious/noExplicitAny: jwt.verify returns unknown, need sub field
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
		callback(null, {
			valid: true,
			user_id: decoded.sub,
		});
	} catch (_error) {
		callback(null, {
			valid: false,
			user_id: "",
		});
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
