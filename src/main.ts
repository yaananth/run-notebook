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
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");

async function run() {
  try {
    const notebookFile = core.getInput('notebook');
    const paramsFile = core.getInput('params');

    fs.mkdirSync(outputDir);
    fs.mkdirSync(scriptsDir);

    const parsedNotebookFile = path.join(outputDir, notebookFile);
    // Install dependencies
    await exec.exec('sudo python -m pip install papermill ipykernel nbformat nbconvert');

    // Execute notebook
    const pythonCode = `
import papermill as pm
import json

params = {}
paramsPath = '${paramsFile}'

if paramsPath:
  with open('params.json', 'r') as paramsFile:
    params = json.loads(paramsFile.read())
pm.execute_notebook(
    '${notebookFile}',
    '${parsedNotebookFile}',
    parameters = dict(params)
)`;
    fs.writeFileSync(executeScriptPath, pythonCode);
    await exec.exec('cat ${executeScriptPath}')
    await exec.exec(`sudo python ${executeScriptPath}`);

    // Convert to HTML
    await exec.exec(`jupyter nbconvert ${parsedNotebookFile} --to html`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
