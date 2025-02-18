import expressWs from "express-ws";
import { WebSocket, Server } from "ws";

import { JsonValue, ReceivedUpdate } from "../types/webxdc";
import { createProcessor, IProcessor, WebXdcMulti, OnMessage } from "./message";
import { Location } from "./location";
import { createPeer, InjectExpress } from "./app";
import { AppInfo } from "./appInfo";
import { getColorForId } from "./color";

// timeout for open in miliseconds
const OPEN_TIMEOUT = 500;

type SendUpdateMessage = {
  type: "sendUpdate";
  update: ReceivedUpdate<JsonValue>;
  descr: string;
};

type SetUpdateListenerMessage = {
  type: "setUpdateListener";
  serial: number;
};

type RequestInfoMessage = {
  type: "requestInfo";
};

class Instance {
  id: string;
  url: string;
  color: string;

  constructor(
    public app: expressWs.Application,
    public port: number,
    public webXdc: WebXdcMulti
  ) {
    this.id = port.toString();
    this.url = `http://localhost:${port}`;
    this.color = getColorForId(this.id);
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Starting webxdc instance at port ${this.port}`);
    });
  }
}

export class Instances {
  location: Location;
  appInfo: AppInfo;
  instances: Map<number, Instance>;
  basePort: number;
  currentPort: number;
  injectSim: InjectExpress;
  processor: IProcessor;
  _onMessage: OnMessage | null = null;

  constructor(appInfo: AppInfo, injectSim: InjectExpress, basePort: number) {
    this.location = appInfo.location;
    this.appInfo = appInfo;
    this.basePort = basePort;
    this.currentPort = basePort;
    this.instances = new Map();
    this.injectSim = injectSim;
    this.processor = createProcessor((message) => {
      if (this._onMessage == null) {
        return;
      }
      this._onMessage(message);
    });
  }

  add(): Instance {
    this.currentPort++;
    const port = this.currentPort;
    if (this.instances.has(port)) {
      throw new Error(`Already have Webxdc instance at port: ${port}`);
    }
    const wsInstance = createPeer(this.location, this.injectSim);
    const app = wsInstance.app;
    const wss = wsInstance.getWss();

    const instance = new Instance(
      app,
      port,
      this.processor.createClient(port.toString())
    );

    app.ws("/webxdc", (ws, req) => {
      // when receiving an update from this peer
      ws.on("message", (msg: string) => {
        if (typeof msg !== "string") {
          console.error(
            "webxdc: Don't know how to handle unexpected non-string data"
          );
          return;
        }
        const parsed = JSON.parse(msg);
        // XXX should validate parsed
        if (isSendUpdateMessage(parsed)) {
          instance.webXdc.sendUpdate(parsed.update, parsed.descr);
        } else if (isSetUpdateListenerMessage(parsed)) {
          instance.webXdc.connect(
            (updates) => {
              console.info("gossip", updates);
              broadcast(
                wss,
                JSON.stringify({
                  type: "updates",
                  updates: updates.map(([update]) => update),
                })
              );
            },
            parsed.serial,
            () => {
              console.info("clear");
              broadcast(wss, JSON.stringify({ type: "clear" }));
            }
          );
        } else if (isRequestInfoMessage(parsed)) {
          ws.send(
            JSON.stringify({
              type: "info",
              info: {
                name: this.appInfo.manifest.name,
                color: instance.color,
              },
            })
          );
        } else {
          throw new Error(`Unknown message: ${JSON.stringify(parsed)}`);
        }
      });
    });
    this.instances.set(port, instance);
    return instance;
  }

  start() {
    for (const instance of this.instances.values()) {
      instance.start();
    }
  }

  clear() {
    this.processor.clear();
  }

  onMessage(onMessage: OnMessage) {
    this._onMessage = onMessage;
  }
}

function broadcast(wss: Server<WebSocket>, data: string) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function isSendUpdateMessage(value: any): value is SendUpdateMessage {
  return value.type === "sendUpdate";
}

function isSetUpdateListenerMessage(
  value: any
): value is SetUpdateListenerMessage {
  return value.type === "setUpdateListener";
}

function isRequestInfoMessage(value: any): value is RequestInfoMessage {
  return value.type === "requestInfo";
}
