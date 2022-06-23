import type {
  Update,
  ReceivedUpdate,
  JsonValue,
  SendUpdate,
} from "../types/webxdc-types";

type UpdateListenerMulti = (updates: ReceivedUpdate<unknown>[]) => void;
type ClearListener = () => void;

type Connect = (
  updateListener: UpdateListenerMulti,
  serial: number,
  clearListener?: ClearListener
) => void;

export type WebXdcMulti = {
  connect: Connect;
  sendUpdate: SendUpdate<unknown>;
};

type UpdateMessage = {
  clientId: string;
  update: ReceivedUpdate<unknown>;
  descr: string;
};

type Message =
  | (UpdateMessage & { type: "sent" })
  | (UpdateMessage & { type: "received" })
  | { type: "clear"; clientId: string };

export interface IProcessor {
  createClient(id: string): WebXdcMulti;
  clear(): void;
}

class Client implements WebXdcMulti {
  updateListener: UpdateListenerMulti | null = null;
  clearListener: ClearListener | null = null;
  updateSerial: number | null = null;

  constructor(public processor: Processor, public id: string) {}

  sendUpdate(update: Update<unknown>, descr: string): void {
    this.processor.distribute(this.id, update, descr);
  }

  connect(
    listener: UpdateListenerMulti,
    serial: number,
    clearListener: ClearListener = () => {}
  ): void {
    this.setClearListener(() => {
      this.processor.messages.push({ type: "clear", clientId: this.id });
      clearListener();
    });
    this.updateListener = (updates) => {
      for (const update of updates) {
        this.processor.messages.push({
          type: "received",
          update: update,
          clientId: this.id,
          descr: "", // XXX should I pass these along?
        });
      }
      return listener(updates);
    };
    this.updateSerial = serial;
    this.processor.catchUp(listener, serial);
  }

  setClearListener(listener: ClearListener): void {
    this.clearListener = listener;
    this.clear();
  }

  receiveUpdate(update: ReceivedUpdate<unknown>) {
    if (this.updateListener == null || this.updateSerial == null) {
      return;
    }
    // don't send the update if it's not required
    if (update.serial <= this.updateSerial) {
      return;
    }
    this.updateListener([update]);
  }

  clear() {
    if (
      this.clearListener == null ||
      this.processor.clearClientIds.has(this.id)
    ) {
      return;
    }
    this.clearListener();
    this.processor.clearClientIds.add(this.id);
  }
}

class Processor implements IProcessor {
  clients: Client[] = [];
  currentSerial: number = 0;
  updates: ReceivedUpdate<unknown>[] = [];
  messages: Message[] = [];
  clearClientIds: Set<string> = new Set();

  createClient(id: string): WebXdcMulti {
    const client = new Client(this, id);
    this.clients.push(client);
    return client;
  }

  distribute(clientId: string, update: Update<unknown>, descr: string) {
    this.currentSerial++;
    const receivedUpdate: ReceivedUpdate<unknown> = {
      ...update,
      serial: this.currentSerial,
      max_serial: this.updates.length + 1,
    };
    this.updates.push(receivedUpdate);
    this.messages.push({
      type: "sent",
      clientId,
      update: receivedUpdate,
      descr,
    });
    for (const client of this.clients) {
      client.receiveUpdate(receivedUpdate);
    }
  }

  clear() {
    this.clearClientIds = new Set();
    for (const client of this.clients) {
      client.clear();
    }
    this.updates = [];
    this.messages = [];
    this.currentSerial = 0;
  }

  catchUp(updateListener: UpdateListenerMulti, serial: number) {
    const maxSerial = this.updates.length;
    updateListener(
      this.updates
        .slice(serial)
        .map((update) => ({ ...update, max_serial: maxSerial }))
    );
  }
}

export function createProcessor(): IProcessor {
  return new Processor();
}
