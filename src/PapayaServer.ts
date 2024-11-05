import { createServer, Server, Socket } from "net";
import {PNPEncryption, PNPMethod, PNPRequest, PNPResponse, Status} from "@papaya-web/pnp-client";

export class PNPServer {
	private server: Server;
	private readonly encryption: PNPEncryption;
	private router: PNPRouter;
	
	constructor(router: PNPRouter) {
		this.server = createServer(this.handleConnection.bind(this));
		this.encryption = new PNPEncryption();
		this.router = router;
	}
	
	public listen(port: number, callback: () => void) {
		this.server.listen(port, callback);
	}
	
	private handleConnection(socket: Socket) {
		socket.on("data", async (data) => {
			const decrypted = this.encryption.decrypt(data);
			const request = this.parseRequest(decrypted);
			const response = this.createEmptyResponse();
			
			this.router.route(request, response, socket, this.encryption);
		});
	}
	
	private parseRequest(data: string): PNPRequest {
		const parsed = JSON.parse(data);
		return {
			method: parsed.method,
			path: parsed.path,
			headers: parsed.headers,
			body: parsed.body
		}
	}
	
	private createEmptyResponse(): PNPResponse {
		return {
			status: 500,
			headers: {},
			body: ""
		}
	}
}

interface RouteData {
	method: PNPMethod,
	path: string
}

export class PNPRouter {
	private routes: Map<RouteData, (req: PNPRequest, res: PNPResponse) => void> = new Map<RouteData, (req: PNPRequest, res: PNPResponse) => void>();
	
	public get(path: string, handler: (req: PNPRequest, res: PNPResponse) => void) {
		this.routes.set({method: "get", path: path}, handler);
	}
	
	public post(path: string, handler: (req: PNPRequest, res: PNPResponse) => void) {
		this.routes.set({method: "post", path: path}, handler);
	}
	
	public route(request: PNPRequest, response: PNPResponse, socket: Socket, encryption: PNPEncryption) {
		let handler = this.routes.get({
			method: request.method,
			path: request.path
		});
		if (handler) {
			handler(request, response);
			this.sendResponse(socket, response, encryption);
		} else {
			response.status = Status.NotFound;
			response.body = "Not Found";
			this.sendResponse(socket, response, encryption);
		}
	}
	
	private sendResponse(socket: Socket, response: PNPResponse, encryption: PNPEncryption) {
		let res = JSON.stringify(response);
		let encrypted = encryption.encrypt(res);
		socket.write(encrypted);
	}
}