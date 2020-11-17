/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
import { ipcRenderer } from "electron";
import * as path from "path";
import { executeRegisteredCallback } from "../../utils/CallbackUtils";
import { relaunchInElectron } from "../../utils/SpawnUtils";
import { CertaConfig } from "../../CertaConfig";

export class ElectronTestRunner {
  public static readonly supportsCoverage = false;
  public static async initialize(config: CertaConfig): Promise<void> {
    console.error("INITIALIZE START");
    // Restart under electron if we're running in node
    if (!("electron" in process.versions))
      return process.exit(await relaunchInElectron());

    console.error("RELAUNCHED");
    // If we are running in electron, we need to append any chromium CLI switches ***before*** the 'ready' event of the app module is emitted.
    const { app } = require("electron");
    if (config.debug)
      app.commandLine.appendSwitch("remote-debugging-port", String(config.ports.frontendDebugging));

    const timeout = new Promise((_resolve, reject) => setTimeout(() => reject("Timed out after 2 minutes when starting electron"), 2 * 60 * 1000));
    await Promise.race([app.whenReady(), timeout]);
    console.error("ELECTRON READY");
  }

  public static async runTests(config: CertaConfig): Promise<void> {
    console.error("RUNTESTS START");
    const { BrowserWindow, app, ipcMain } = require("electron"); // eslint-disable-line @typescript-eslint/naming-convention

    const rendererWindow = new BrowserWindow({
      show: config.debug,
      webPreferences: {
        nodeIntegration: true,
        enableRemoteModule: true,
      },
    });
    console.error("BROWSERWINDOW CREATED");

    const exitElectronApp = (exitCode: number) => {
      // Passing exit code to parent process doesn't seem to work anymore with electron 10 - sending message with status instead
      // See note in SpawnUtils.onExitElectronApp
      if (process.send)
        process.send({ exitCode });
      app.exit(exitCode);
    };

    ipcMain.on("certa-done", (_e: any, count: number) => {
      rendererWindow.webContents.once("destroyed", () => {
        exitElectronApp(count);
      });
      setImmediate(() => rendererWindow.close());
    });

    ipcMain.on("certa-error", (_e: any, { message, stack }: any) => {
      console.error("Uncaught Error in Tests: ", message);
      console.error(stack);
      rendererWindow.webContents.once("destroyed", () => {
        exitElectronApp(1);
      });
      rendererWindow.close();
    });

    ipcMain.on("certa-callback", async (event: any, msg: any) => {
      event.returnValue = await executeRegisteredCallback(msg.name, msg.args);
    });

    rendererWindow.webContents.once("did-finish-load", async () => {
      try {
        console.error("DFL HANDLER STARTED");
        const initScriptPath = require.resolve("./initElectronTests.js");
        const startTests = async () => rendererWindow.webContents.executeJavaScript(`
        var _CERTA_CONFIG = ${JSON.stringify(config)};
        require(${JSON.stringify(initScriptPath)});
        startCertaTests(${JSON.stringify(config.testBundle)});`);

        if (config.debug) {
          // For some reason, the VS Code chrome debugger doesn't work correctly unless we reload the window before running tests.
          await rendererWindow.webContents.executeJavaScript(`window.location.reload();`);
          // Note that we'll have to wait for the did-finish-load event again since we just reloaded.
          rendererWindow.webContents.once("did-finish-load", startTests);
          return;
        }
        console.error("STARTING TESTS");
        await startTests();
      } catch ({ message, stack }) {
        console.error("ERROR IN DFL HANDLER");
        ipcRenderer.send("certa-error", { message, stack });
      }
    });
    console.error("HANDLERS REGISTERED");
    await rendererWindow.loadFile(path.join(__dirname, "../../../public/index.html"));
    console.error("LOADED");
  }
}
