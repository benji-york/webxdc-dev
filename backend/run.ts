import process from "process";
import open from "open";

import { createFrontend, InjectExpress } from "./app";
import { Instances } from "./instance";
import { getLocation, Location, LocationError } from "./location";
import { getAppInfo, AppInfo, AppInfoError } from "./appInfo";

export type Inject = {
  injectFrontend: InjectExpress;
  injectSim: InjectExpress;
  getIndexHtml: () => string;
};

function actualRun(appInfo: AppInfo, basePort: number, inject: Inject): void {
  const { injectFrontend, injectSim, getIndexHtml } = inject;

  const instances = new Instances(appInfo, injectSim, basePort);

  const numberOfInstances = 2;
  for (let i = 0; i < numberOfInstances; i++) {
    instances.add();
  }

  const frontend = createFrontend(
    appInfo,
    instances,
    injectFrontend,
    getIndexHtml
  );

  frontend.listen(basePort, () => {
    console.log("Starting webxdc-dev frontend");
  });

  instances.start();

  open("http://localhost:" + basePort);
}

export function run(locationStr: string, basePort: number, inject: Inject) {
  let location: Location;
  try {
    location = getLocation(locationStr);
  } catch (e) {
    if (e instanceof LocationError) {
      console.error(e.message);
      return;
    }
    throw e;
  }

  for (const signal in ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      location.dispose();
    });
  }

  console.log("Starting webxdc project in:", locationStr);

  getAppInfo(location)
    .then((appInfo) => {
      actualRun(appInfo, basePort, inject);
    })
    .catch((e) => {
      if (e instanceof AppInfoError) {
        console.error(e.message);
        return;
      }
      throw e;
    });
}
