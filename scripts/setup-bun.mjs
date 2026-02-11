#!/usr/bin/env node

/**
 * Auto-installs bun if it's not already available.
 * Used in the postinstall script to ensure bun is available for building.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";
import { join } from "path";

function isBunInstalled() {
  try {
    execSync("bun --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installBun() {
  console.log("Installing bun...");
  
  const isWindows = platform() === "win32";
  
  if (isWindows) {
    console.log("Windows detected. Please install bun manually from https://bun.sh");
    console.log("Or use PowerShell: irm bun.sh/install.ps1 | iex");
    return;
  }

  try {
    execSync("curl -fsSL https://bun.sh/install | bash", {
      stdio: "inherit",
      shell: "/bin/bash",
    });
    console.log("Bun installed successfully!");
  } catch (error) {
    console.error("Failed to install bun:", error);
    console.log("Please install bun manually from https://bun.sh");
  }
}

if (!isBunInstalled()) {
  installBun();
} else {
  console.log("Bun is already installed");
}
