import { createStore, produce } from "solid-js/store";
import { createResource } from "solid-js";
import type { Message, UpdateMessage } from "../types/message";

export type AppInfo = {
  name: string;
  iconUrl: string;
  sourceCodeUrl: string;
  manifestFound: boolean;
  toolVersion: string;
};

const [appInfo] = createResource<AppInfo>(async () => {
  return await (await fetch("/app-info")).json();
});

export { appInfo };

export type InstanceData = {
  id: string;
  url: string;
  color: string;
};

const [instances, { refetch: refetchInstances }] = createResource<
  InstanceData[]
>(async () => {
  return (await fetch(`/instances`)).json();
});

export { instances, refetchInstances };

const [state, setState] = createStore<Message[]>([]);

export function addMessage(message: Message): void {
  setState(
    produce((s) => {
      s.push(message);
    })
  );
}

export function clearMessages(): void {
  setState([]);
}

export function sent(instanceId: string): number {
  let result = 0;
  for (const message of state) {
    if (message.type === "sent" && message.instanceId === instanceId) {
      result++;
    }
  }
  return result;
}

export function received(instanceId: string): number {
  let result = 0;
  for (const message of state) {
    if (message.type === "received" && message.instanceId === instanceId) {
      result++;
    }
  }
  return result;
}

export function getMessages(
  instanceId: string | undefined,
  type: string | undefined
): Message[] {
  if (instanceId == null && type == null) {
    return state;
  }
  return state.filter(
    (message) =>
      (instanceId == null || message.instanceId === instanceId) &&
      (type == null || message.type === type)
  );
}

export function isUpdateMessage(message: Message): message is UpdateMessage {
  return message.type === "sent" || message.type === "received";
}
