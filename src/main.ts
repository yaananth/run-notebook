import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from "fs";
import * as path from "path";

interface IRunnerContext {
  os: string;
  tool_cache: string;
  temp: string;
  workspace: string;
}

// These are added run actions using "env:"
let runner: IRunnerContext = JSON.parse(process.env.RUNNER || "");
const outputDir = path.join(runner.temp, "nb-runner");

async function run() {
  try {
    const notebookFile = core.getInput('notebook');
    const paramsFile = core.getInput('params');

    const parsedNotebookFile = path.join(outputDir, notebookFile);
    // Install dependencies
    await exec.exec('sudo python -m pip install papermill ipykernel nbformat nbconvert');

    // Execute notebook
    const pythonCode = `
    import papermill as pm
    import json
    import os

    params = {}
    os.makedirs('${outputDir}')
    paramsPath = '${paramsFile}'

    if paramsPath:
      with open('params.json', 'r') as paramsFile:
        params = json.loads(paramsFile.read())
    pm.execute_notebook(
        '${notebookFile}',
        '${parsedNotebookFile}',
        parameters = dict(params)
    )
    `;
    await exec.exec(`sudo python -c ${pythonCode}`);

    // Convert to HTML
    await exec.exec(`jupyter nbconvert ${notebookFile} --to html`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
