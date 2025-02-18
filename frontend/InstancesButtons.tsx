import type { Component } from "solid-js";
import { Button, notificationService, Flex, Tooltip } from "@hope-ui/solid";

import { clearMessages, refetchInstances } from "./store";

const CLEAR_INFO = `\
Reset both webxdc-dev server state as well as client state.
This wipes out any localStorage and sessionStorage on each client, and reloads them.`;

const InstancesButtons: Component<{
  onAfterAdd?: (instanceId: string) => void;
}> = (props) => {
  const handleAddInstance = async () => {
    const { port, id } = await (
      await fetch(`/instances`, { method: "POST" })
    ).json();
    await refetchInstances();
    if (props.onAfterAdd != null) {
      props.onAfterAdd(id);
    }
    notificationService.show({
      title: `New instance ${port} added`,
    });
  };

  const handleClear = async () => {
    await fetch(`/clear`, { method: "POST" });
    clearMessages();
    notificationService.show({
      title: `Resetting state of dev server & instances`,
    });
  };

  return (
    <Flex direction="row" justifyContent="flex-start" gap="$3">
      <Button onClick={handleAddInstance}>Add Instance</Button>
      <Tooltip label={CLEAR_INFO}>
        <Button onClick={handleClear}>Reset</Button>
      </Tooltip>
    </Flex>
  );
};

export default InstancesButtons;
